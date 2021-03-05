//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
//import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "../interfaces/IPortfolioRouter.sol";
import "../interfaces/IPortfolio.sol";
import "../interfaces/IExchangeAdapter.sol";
import "../libraries/PortfolioLibrary.sol";

abstract contract PortfolioRouter is IPortfolioRouter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public override controller;
    address public override weth;

    constructor(address controller_, address weth_) public {
        controller = controller_;
        weth = weth_;
    }

    /**
     * @dev Throws if called by any account other than the controller.
     */
    modifier onlyController() {
        require(controller == msg.sender, "PR.onlyController: only controller");
        _;
    }

    // Abstract external functions to be defined by inheritor
    function deposit(address portfolio, bytes calldata data) external virtual override;

    function rebalance(address portfolio, bytes calldata data) external virtual override;

    // Public functions
    function sellTokens(
        address portfolio,
        address[] memory tokens,
        address[] memory adapters
    ) public override onlyController {
        for (uint256 i = 0; i < tokens.length; i++) {
            // Convert funds into Ether
            address tokenAddress = tokens[i];
            uint256 amount = IERC20(tokenAddress).balanceOf(portfolio);
            if (tokenAddress == weth) {
                IERC20(tokenAddress).safeTransferFrom(portfolio, msg.sender, amount);
            } else {
                require(
                    _delegateSwap(
                        adapters[i],
                        amount,
                        0,
                        tokenAddress,
                        weth,
                        portfolio,
                        msg.sender,
                        new bytes(0)
                    ),
                    "PR.sellTokens: Swap failed"
                );
            }
        }
    }

    function buyTokens(
        address portfolio,
        address[] memory tokens,
        address[] memory adapters
    ) public override onlyController {
        require(tokens.length > 0, "PR.convert: Tokens not yet set");
        require(adapters.length == tokens.length, "PR.convert: Routers/tokens mismatch");
        uint256 total = IERC20(weth).balanceOf(msg.sender);
        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddress = tokens[i];
            uint256 amount =
                i == tokens.length - 1
                    ? IERC20(weth).balanceOf(msg.sender)
                    : PortfolioLibrary.getExpectedTokenValue(total, portfolio, tokenAddress);
            if (tokenAddress == weth) {
                IERC20(tokenAddress).safeTransferFrom(msg.sender, portfolio, amount);
            } else {
                // Convert WETH to Token
                require(
                    _delegateSwap(
                        adapters[i],
                        amount,
                        0,
                        weth,
                        tokenAddress,
                        msg.sender,
                        portfolio,
                        new bytes(0)
                    ),
                    "PR.buyTokens: Swap failed"
                );
            }
        }
        require(IERC20(weth).balanceOf(address(this)) == uint256(0), "PR.convert: Leftover funds");
    }

    function _delegateSwap(
        address adapter,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to,
        bytes memory data
    ) internal returns (bool success) {
        bytes memory package = IExchangeAdapter(adapter).getPackage();
        bytes memory swapData =
            abi.encodeWithSelector(
                bytes4(
                    keccak256("swap(uint256,uint256,address,address,address,address,bytes,bytes)")
                ),
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
            success := delegatecall(txGas, adapter, add(swapData, 0x20), mload(swapData), 0, 0)
        }
    }

    receive() external payable {
        assert(msg.sender == weth); // only accept ETH via fallback from the WETH contract
    }
}
