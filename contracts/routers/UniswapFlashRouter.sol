//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./PortfolioRouter.sol";
import "../interfaces/IPortfolioController.sol";
import "../libraries/UniswapV2Library.sol";

contract UniswapFlashRouter is PortfolioRouter, IUniswapV2Callee {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant FEE = 997;
    uint256 private constant DIVISOR = 1000;
    address private factory;
    IExchangeAdapter private adapter;

    constructor(
        address adapter_,
        address factory_,
        address controller_,
        address weth_
    ) public PortfolioRouter(controller_, weth_) {
        factory = factory_;
        adapter = IExchangeAdapter(adapter_);
    }

    function deposit(address portfolio, bytes calldata data)
        external
        override
        onlyController
    {
        (address[] memory tokens, address[] memory routers) =
            abi.decode(data, (address[], address[]));
        buyTokens(portfolio, tokens, routers);
    }

    function rebalance(address portfolio, bytes calldata data) external override onlyController {
        (uint256 total, uint256[] memory estimates) = abi.decode(data, (uint256, uint256[]));
        // Flash swap to cover purchases, rebalance, and settle up
        // https://uniswap.org/docs/v2/core-concepts/flash-swaps/
        uint256 wethAmount = total.mul(FEE).div(DIVISOR);
        uint256 pairAmount = 0;
        // Get pair token
        uint256 index = IPortfolio(portfolio).tokens()[0] == weth ? 1 : 0;
        address pairToken = IPortfolio(portfolio).tokens()[index];
        {
            uint256 expectedPairValue =
                PortfolioLibrary.getExpectedTokenValue(wethAmount, portfolio, pairToken);
            uint256 rebalanceRange =
                PortfolioLibrary.getRange(
                    expectedPairValue,
                    IPortfolioController(msg.sender).rebalanceThreshold(portfolio)
                );
            if (estimates[index] < expectedPairValue.add(rebalanceRange)) {
                uint256 diff = expectedPairValue.sub(estimates[index]).mul(FEE).div(DIVISOR);
                pairAmount = adapter.spotPrice(diff, weth, pairToken);
                wethAmount = wethAmount.sub(diff);
            }
        }
        // Do flash swap
        _pairSwap(
            pairAmount,
            wethAmount,
            pairToken,
            weth,
            address(this),
            abi.encode(portfolio, estimates)
        );
        // Hate this, but need to sort out extra weth if there is any
        if (
            IPortfolio(portfolio).tokenPercentage(weth) == 0 &&
            IERC20(weth).balanceOf(portfolio) > 0
        ) {
            adapter.swap(
                IERC20(weth).balanceOf(portfolio),
                0,
                weth,
                pairToken,
                portfolio,
                portfolio,
                new bytes(0),
                new bytes(0)
            );
        }
    }

    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override {
        assert(sender == address(this));
        (address portfolio, ) = abi.decode(data, (address, uint256[]));
        uint256 repay;
        uint256 total;
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        {
            assert(msg.sender == UniswapV2Library.pairFor(factory, token0, token1));
            if (token0 == address(weth)) {
                if (amount1 > 0) {
                    repay = amount0.add(
                        adapter.spotPrice(amount1, token1, token0).mul(DIVISOR).div(FEE)
                    );
                    IERC20(token1).safeTransfer(portfolio, amount1);
                } else {
                    repay = amount0;
                }
            } else {
                if (amount0 > 0) {
                    repay = amount1.add(
                        adapter.spotPrice(amount0, token0, token1).mul(DIVISOR).div(FEE)
                    );
                    IERC20(token0).safeTransfer(portfolio, amount0);
                } else {
                    repay = amount1;
                }
            }
            total = repay;
            repay = repay.mul(DIVISOR).div(FEE);
        }

        {
            (, uint256[] memory estimates) = abi.decode(data, (address, uint256[]));
            address[] memory tokens = IPortfolio(portfolio).tokens();
            IERC20(weth).safeApprove(address(adapter), uint256(-1));
            for (uint256 i = 0; i < tokens.length; i++) {
                if (tokens[i] != token0 && tokens[i] != token1) {
                    _rebalanceToken(portfolio, tokens[i], estimates[i], total);
                } else {
                    repay = repay.sub(_getDiffValue(portfolio, tokens[i], estimates[i], total));
                }
            }
        }
        {
            repay = repay.sub(
                _settleFlashPair(portfolio, msg.sender, token0, token1, total, repay)
            );
            IERC20 wethToken = IERC20(weth);
            wethToken.safeTransfer(msg.sender, repay);
            uint256 amountRemaining = wethToken.balanceOf(address(this));
            if (amountRemaining > 0) {
                wethToken.safeTransfer(sender, amountRemaining);
            }
        }
    }

    function _pairSwap(
        uint256 tokenAOut,
        uint256 tokenBOut,
        address tokenA,
        address tokenB,
        address to,
        bytes memory data
    ) internal virtual {
        (address token0, ) = UniswapV2Library.sortTokens(tokenA, tokenB);
        (uint256 amount0Out, uint256 amount1Out) =
            tokenA == token0 ? (tokenAOut, tokenBOut) : (tokenBOut, tokenAOut);
        IUniswapV2Pair(UniswapV2Library.pairFor(factory, tokenA, tokenB)).swap(
            amount0Out,
            amount1Out,
            to,
            data
        );
    }

    function _rebalanceToken(
        address portfolioAddress,
        address tokenAddress,
        uint256 estimatedValue,
        uint256 total
    ) internal {
        uint256 expectedValue =
            PortfolioLibrary.getExpectedTokenValue(total, portfolioAddress, tokenAddress);
        uint256 rebalanceRange =
            PortfolioLibrary.getRange(
                expectedValue,
                IPortfolio(portfolioAddress).tokenPercentage(tokenAddress)
            );
        if (estimatedValue > expectedValue.add(rebalanceRange)) {
            /*
            uint256 diff = adapter.spotPrice(
                estimatedValue.sub(expectedValue),
                weth,
                tokenAddress
            ).mul(DIVISOR).div(FEE);
            */
            uint256 diff =
                adapter
                    .spotPrice(estimatedValue.sub(expectedValue), weth, tokenAddress)
                    .mul(DIVISOR)
                    .div(FEE);
            IERC20(tokenAddress).safeTransferFrom(portfolioAddress, address(this), diff);
            IERC20(tokenAddress).safeApprove(address(adapter), diff);
            adapter.swap(
                diff,
                0,
                tokenAddress,
                weth,
                address(this),
                address(this),
                new bytes(0),
                new bytes(0)
            );
        }
        if (estimatedValue < expectedValue.sub(rebalanceRange)) {
            uint256 diff = expectedValue.sub(estimatedValue);
            adapter.swap(
                diff.mul(FEE).div(DIVISOR),
                0,
                weth,
                tokenAddress,
                address(this),
                portfolioAddress,
                new bytes(0),
                new bytes(0)
            );
        }
    }

    function _settleFlashPair(
        address portfolioAddress,
        address uniswapAddress,
        address token0,
        address token1,
        uint256 total,
        uint256 repay
    ) internal returns (uint256) {
        uint256 excessWeth = IERC20(weth).balanceOf(address(this));
        if (IPortfolio(portfolioAddress).tokenPercentage(weth) > 0) {
            //Settle weth
            uint256 wethValue = IERC20(weth).balanceOf(portfolioAddress);
            uint256 expectedWethValue =
                PortfolioLibrary.getExpectedTokenValue(total, portfolioAddress, weth);
            if (wethValue > expectedWethValue) {
                uint256 wethRemoved = wethValue.sub(expectedWethValue);
                IERC20(weth).safeTransferFrom(portfolioAddress, address(this), wethRemoved);
                excessWeth = excessWeth.add(wethRemoved);
            } else {
                uint256 wethNeeded = expectedWethValue.sub(wethValue);
                // There should never be a scenario where excess weth is less than weth needed
                assert(excessWeth >= wethNeeded);
                IERC20(weth).safeTransferFrom(address(this), portfolioAddress, wethNeeded);
                excessWeth = excessWeth.sub(wethNeeded);
            }
        }
        IERC20 pairToken = IERC20(token0 == weth ? token1 : token0);
        //Settle pair token
        uint256 estimatedValue =
            adapter.spotPrice(pairToken.balanceOf(portfolioAddress), address(pairToken), weth);
        uint256 expectedValue =
            PortfolioLibrary.getExpectedTokenValue(total, portfolioAddress, address(pairToken));
        if (estimatedValue > expectedValue) {
            uint256 diff;
            {
                diff = adapter.spotPrice(
                    estimatedValue.sub(expectedValue).mul(DIVISOR).div(FEE),
                    weth,
                    address(pairToken)
                );
            }
            if (excessWeth > repay) {
                // In case we have extra weth, we don't have to pay back as much of the flash pair token
                excessWeth = excessWeth.sub(repay);
                uint256 excessTokenEquivalent =
                    adapter.spotPrice(excessWeth, weth, address(pairToken));
                if (excessTokenEquivalent < diff) {
                    diff = diff.sub(excessTokenEquivalent);
                    pairToken.safeTransferFrom(portfolioAddress, uniswapAddress, diff);
                }
                //Potentially paying to0 much here if excessTokenEquivalent > diff!
                IERC20(weth).safeTransfer(uniswapAddress, excessWeth);
            } else {
                //If we don't have enough weth to pay loan, we take more from the flash pair token
                uint256 repayDiff = repay.sub(excessWeth);
                if (repayDiff > 0) {
                    diff = diff.add(adapter.spotPrice(repayDiff, weth, address(pairToken)));
                }
                pairToken.safeTransferFrom(portfolioAddress, uniswapAddress, diff);
                return repayDiff;
            }
        } else {
            //Need to swap weth for this token, but swap contract is locked!!
            assert(excessWeth >= repay);
        }
        return 0;
    }

    function _getDiffValue(
        address portfolioAddress,
        address tokenAddress,
        uint256 estimatedValue,
        uint256 total
    ) internal view returns (uint256) {
        uint256 expectedValue =
            PortfolioLibrary.getExpectedTokenValue(total, portfolioAddress, tokenAddress);
        if (estimatedValue > expectedValue) {
            return estimatedValue.sub(expectedValue);
        } else {
            return 0;
        }
    }

    /*
    receive() external payable {
        assert(msg.sender == weth); // only accept ETH via fallback from the WETH contract
    }
    */
}
