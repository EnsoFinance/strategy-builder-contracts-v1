//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "../interfaces/IPortfolioController.sol";
import "../interfaces/IPortfolio.sol";
import "../interfaces/IPortfolioRouter.sol";
import "../libraries/PortfolioLibrary.sol";
import "hardhat/console.sol";

abstract contract PortfolioController is
    IPortfolioController //solhint-disable-line
{
    using SafeMath for uint256;

    address public override weth;

    constructor(address weth_) public {
        weth = weth_;
    }

    // External functions
    /*
    function deposit(address depositor, address[] memory tokens, address[] memory routers) external payable override {
        // Convert tokens
        buyTokens(tokens, routers);
        // Mint portfolio tokens
        IPortfolio portfolio = IPortfolio(msg.sender);
        if (portfolio.totalSupply() == uint256(0)) {
            // Create initial supply based on msg.value (1:1 ratio)
            portfolio.mint(depositor, msg.value);
        } else {
            (uint256 total, ) = IOracle(portfolio.oracle()).estimateTotal(
                address(portfolio),
                portfolio.getPortfolioTokens()
            );
            uint256 relativeTokens = portfolio.totalSupply().mul(msg.value).div(total);
            portfolio.mint(depositor, relativeTokens);
        }
    }

    function withdraw(address withdrawer, uint256 amount) external override {
        // Get withdraw percentage
        uint256 percentage = amount.mul(10**18).div(IPortfolio(msg.sender).totalSupply());
        IPortfolio(msg.sender).burn(withdrawer, amount);
        address[] memory tokens = IPortfolio(msg.sender).getPortfolioTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            // Should not be possible to have address(0) since the Portfolio will check for it
            IERC20 token = IERC20(tokens[i]);
            uint256 currentBalance = token.balanceOf(msg.sender);
            uint256 tokenAmount =
                currentBalance.mul(percentage).div(10**18);
            token.transferFrom(msg.sender, withdrawer, tokenAmount);
        }
    }
    */
    // Abstract external functions to be defined by inheritor
    function rebalance(bytes calldata data) external virtual override;

    function sellTokens(address[] memory tokens, address[] memory routers) external override {
        for (uint256 i = 0; i < tokens.length; i++) {
            // Convert funds into Ether
            address tokenAddress = tokens[i];
            uint256 amount = IERC20(tokenAddress).balanceOf(msg.sender);
            if (tokenAddress == weth) {
                IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
                IWETH(weth).withdraw(amount);
                msg.sender.transfer(amount);
            } else {
                require(
                    _delegateSwap(
                        routers[i],
                        amount,
                        0,
                        tokenAddress,
                        address(0),
                        msg.sender,
                        msg.sender,
                        new bytes(0)
                    ),
                    "PortfolioController.sellTokens: Swap failed"
                );

                /*
                IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
                IERC20(tokenAddress).approve(routers[i], amount);

                IPortfolioRouter(routers[i]).swap(
                    amount,
                    0,
                    tokenAddress,
                    address(0),
                    address(this),
                    msg.sender,
                    new bytes(0),
                    new bytes(0)
                );
                */
            }
        }
    }

    function buyTokens(address[] memory tokens, address[] memory routers) external payable override {
        require(tokens.length > 0, "PortfolioController.convert: Tokens not yet set");
        require(routers.length == tokens.length, "PortfolioController.convert: Routers/tokens mismatch");
        console.log("Balance before: ", address(this).balance);
        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddress = tokens[i];
            uint256 amount =
                i == tokens.length - 1
                    ? address(this).balance
                    : PortfolioLibrary.getExpectedTokenValue(msg.value, msg.sender, tokenAddress); // solhint-disable-line
            if (tokenAddress == weth) {
                // Wrap ETH to WETH
                IWETH(weth).deposit{ value: amount }(); // solhint-disable-line
                // Transfer weth back to sender
                IERC20(weth).transfer(msg.sender, amount);
            } else {
                // Convert ETH to Token
                /*
                require(
                    _delegateSwap(
                        routers[i],
                        amount,
                        0,
                        address(0),
                        tokenAddress,
                        msg.sender,
                        msg.sender,
                        new bytes(0)),
                    "PortfolioController.buyTokens: Swap failed"
                );
                */

                IPortfolioRouter(routers[i]).swap{ value: amount }( // solhint-disable-line
                    amount,
                    0,
                    address(0),
                    tokenAddress,
                    msg.sender,
                    msg.sender,
                    new bytes(0),
                    new bytes(0)
                );
            }
        }
        console.log("Balance after: ", address(this).balance);
        require(address(this).balance == uint256(0), "PortfolioController.convert: Leftover funds");
    }

    function _delegateSwap(
        address router,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to,
        bytes memory data
    ) internal returns (bool success) {
        bytes memory package = IPortfolioRouter(router).getPackage();
        bytes memory swapData =
            abi.encodeWithSelector(
                bytes4(keccak256("swap(uint256,uint256,address,address,address,address,bytes,bytes)")), // solhint-disable-line
                amount,
                expected,
                tokenIn,
                tokenOut,
                from,
                to,
                data,
                package
            );
        uint256 txGas = gasleft();
        assembly {
            success := delegatecall(txGas, router, add(swapData, 0x20), mload(swapData), 0, 0)
        }
    }

    receive() external payable {
        assert(msg.sender == weth); // only accept ETH via fallback from the WETH contract
    }
}
