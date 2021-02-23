//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IPortfolioController.sol";
import "../libraries/UniswapV2Library.sol";
import "./PortfolioRouter.sol";

contract LoopRouter is PortfolioRouter {
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
        payable
        override
        onlyController
    {
        (address[] memory tokens, address[] memory routers) =
            abi.decode(data, (address[], address[])); //solhint-disable-line
        buyTokens(portfolio, tokens, routers);
    }

    function rebalance(address portfolio, bytes calldata data) external override onlyController {
        (uint256 total, uint256[] memory estimates) = abi.decode(data, (uint256, uint256[])); //solhint-disable-line
        address[] memory tokens = IPortfolio(portfolio).tokens();

        address[] memory buyTokens = new address[](tokens.length);
        uint256[] memory buyEstimates = new uint256[](tokens.length);
        uint256 buyCount = 0;
        // Sell loop
        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddress = tokens[i];
            if (tokenAddress != weth) {
                if (!_sellToken(portfolio, tokenAddress, estimates[i], total)) {
                    buyTokens[buyCount] = tokens[i];
                    buyEstimates[buyCount] = estimates[i];
                    buyCount++;
                }
            }
        }
        bool wethInPortfolio = IPortfolio(portfolio).tokenPercentage(weth) != 0;
        // Buy loop
        IERC20(weth).safeApprove(address(adapter), uint256(-1));
        for (uint256 i = 0; i < buyCount; i++) {
            _buyToken(
                portfolio,
                buyTokens[i],
                buyEstimates[i],
                total,
                i == buyCount - 1 && !wethInPortfolio // If the last token use up remainder of WETH
            );
        }
        if (wethInPortfolio) {
            uint256 balance = IERC20(weth).balanceOf(address(this));
            if (balance > 0) {
                IERC20(weth).safeTransfer(portfolio, balance);
            }
        }
        IERC20(weth).safeApprove(address(adapter), uint256(0));
    }

    function _sellToken(
        address portfolio,
        address tokenAddress,
        uint256 estimatedValue,
        uint256 total
    ) internal returns (bool) {
        uint256 expectedValue =
            PortfolioLibrary.getExpectedTokenValue(total, portfolio, tokenAddress);
        uint256 rebalanceRange =
            PortfolioLibrary.getRange(
                expectedValue,
                IPortfolioController(msg.sender).rebalanceThreshold(portfolio)
            );
        if (estimatedValue > expectedValue.add(rebalanceRange)) {
            uint256 diff =
                adapter
                    .spotPrice(estimatedValue.sub(expectedValue), weth, tokenAddress)
                    .mul(DIVISOR)
                    .div(FEE);
            require(
                _delegateSwap(
                    address(adapter),
                    diff,
                    0,
                    tokenAddress,
                    weth,
                    portfolio,
                    address(this),
                    new bytes(0)
                ),
                "LR._sT: Swap failed"
            );
            return true;
        }
        return false;
    }

    function _buyToken(
        address portfolio,
        address tokenAddress,
        uint256 estimatedValue,
        uint256 total,
        bool lastToken
    ) internal {
        if (lastToken) {
            require(
                _delegateSwap(
                    address(adapter),
                    IERC20(weth).balanceOf(address(this)),
                    0,
                    weth,
                    tokenAddress,
                    address(this),
                    portfolio,
                    new bytes(0)
                ),
                "LR._bT: Swap failed"
            );
        } else {
            uint256 expectedValue =
                PortfolioLibrary.getExpectedTokenValue(total, portfolio, tokenAddress);
            uint256 rebalanceRange =
                PortfolioLibrary.getRange(
                    expectedValue,
                    IPortfolioController(msg.sender).rebalanceThreshold(portfolio)
                );
            if (estimatedValue < expectedValue.sub(rebalanceRange)) {
                uint256 diff = expectedValue.sub(estimatedValue);
                require(
                    _delegateSwap(
                        address(adapter),
                        diff,
                        0,
                        weth,
                        tokenAddress,
                        address(this),
                        portfolio,
                        new bytes(0)
                    ),
                    "LR._bT: Swap failed"
                );
            }
        }
    }
}
