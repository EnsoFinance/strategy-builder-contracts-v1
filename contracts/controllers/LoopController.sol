//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/UniswapV2Library.sol";
import "./PortfolioController.sol";

contract LoopController is PortfolioController {
    using SafeMath for uint256;

    uint256 private constant FEE = 997;
    uint256 private constant DIVISOR = 1000;
    address private factory;
    IPortfolioRouter private router;

    constructor(
        address router_,
        address factory_,
        address weth_
    ) public PortfolioController(weth_) {
        factory = factory_;
        router = IPortfolioRouter(router_);
    }

    function rebalance(bytes calldata data) external override {
        (uint256 total, uint256[] memory estimates) = abi.decode(data, (uint256, uint256[])); //solhint-disable-line
        address[] memory tokens = IPortfolio(msg.sender).getPortfolioTokens();
        bool wethInPortfolio = IPortfolio(msg.sender).getTokenPercentage(weth) != 0;
        // Sell loop
        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddress = tokens[i];
            if (tokenAddress != weth) {
                _sellToken(tokenAddress, estimates[i], total);
            }
        }
        // Buy loop
        IERC20(weth).approve(address(router), uint256(-1));
        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddress = tokens[i];
            if (tokenAddress != weth) {
                _buyToken(
                    tokenAddress,
                    estimates[i],
                    total,
                    i == tokens.length - 1 && !wethInPortfolio // If the last token use up remainder of WETH
                );
            }
        }
        if (wethInPortfolio) {
            uint256 balance = IERC20(weth).balanceOf(address(this));
            if (balance > 0) {
                IERC20(weth).transfer(msg.sender, balance);
            }
        }
    }

    function _sellToken(
        address tokenAddress,
        uint256 estimatedValue,
        uint256 total
    ) internal {
        uint256 expectedValue = PortfolioLibrary.getExpectedTokenValue(total, msg.sender, tokenAddress);
        uint256 rebalanceRange = PortfolioLibrary.getRange(expectedValue, IPortfolio(msg.sender).rebalanceThreshold());
        if (estimatedValue > expectedValue.add(rebalanceRange)) {
            uint256 diff =
                router.spotPrice(estimatedValue.sub(expectedValue), weth, tokenAddress).mul(DIVISOR).div(FEE);
            //IERC20(tokenAddress).transferFrom(msg.sender, address(this), diff);
            //IERC20(tokenAddress).approve(address(router), diff);
            //router.swap(diff, 0, tokenAddress, weth, address(this), address(this), new bytes(0));
            require(
                _delegateSwap(address(router), diff, 0, tokenAddress, weth, msg.sender, address(this), new bytes(0)),
                "LoopController._sellToken: Swap failed"
            );
        }
    }

    function _buyToken(
        address tokenAddress,
        uint256 estimatedValue,
        uint256 total,
        bool lastToken
    ) internal {
        if (lastToken) {
            /*
            router.swap(
                IERC20(weth).balanceOf(address(this)),
                0,
                weth,
                tokenAddress,
                address(this),
                msg.sender,
                new bytes(0)
            );
            */
            require(
                _delegateSwap(
                    address(router),
                    IERC20(weth).balanceOf(address(this)),
                    0,
                    weth,
                    tokenAddress,
                    address(this),
                    msg.sender,
                    new bytes(0)
                ),
                "LoopController._buyToken: Swap failed"
            );
        } else {
            uint256 expectedValue = PortfolioLibrary.getExpectedTokenValue(total, msg.sender, tokenAddress);
            uint256 rebalanceRange =
                PortfolioLibrary.getRange(expectedValue, IPortfolio(msg.sender).rebalanceThreshold());
            if (estimatedValue < expectedValue.sub(rebalanceRange)) {
                uint256 diff = expectedValue.sub(estimatedValue).mul(FEE).div(DIVISOR);
                //router.swap(diff, 0, weth, tokenAddress, address(this), msg.sender, new bytes(0));
                require(
                    _delegateSwap(
                        address(router),
                        diff,
                        0,
                        weth,
                        tokenAddress,
                        address(this),
                        msg.sender,
                        new bytes(0)
                    ),
                    "LoopController._buyToken: Swap failed"
                );
            }
        }
    }
}
