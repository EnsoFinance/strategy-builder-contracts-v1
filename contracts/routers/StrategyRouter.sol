//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../libraries/SafeERC20.sol";
import "../interfaces/IStrategyRouter.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IBaseAdapter.sol";
import "../helpers/StrategyTypes.sol";

abstract contract StrategyRouter is IStrategyRouter, StrategyTypes {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    uint256 internal constant DIVISOR = 1000;
    uint256 internal constant _1e18 = 1e18;

    RouterCategory public override immutable category;
    IStrategyController public override immutable controller;
    address public immutable weth;

    constructor(RouterCategory category_, address controller_) public {
        category = category_;
        controller = IStrategyController(controller_);
        weth = IStrategyController(controller_).oracle().weth();
    }

    /**
     * @dev Throws if called by any account other than the controller.
     */
    modifier onlyController() {
        require(address(controller) == msg.sender, "Only controller");
        _;
    }

    // Abstract external functions to be defined by inheritor
    function deposit(address strategy, bytes calldata data) external virtual override;

    function withdraw(address strategy, bytes calldata data) external virtual override;

    function rebalance(address strategy, bytes calldata data) external virtual override;

    function restructure(address strategy, bytes calldata data) external virtual override;

    function _delegateSwap(
        address adapter,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) internal {
        require(controller.whitelist().approved(adapter), "Not approved");
        bytes memory swapData =
            abi.encodeWithSelector(
                IBaseAdapter.swap.selector,
                amount,
                expected,
                tokenIn,
                tokenOut,
                from,
                to
            );
        uint256 txGas = gasleft();
        bool success;
        assembly {
            success := delegatecall(txGas, adapter, add(swapData, 0x20), mload(swapData), 0, 0)
        }
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }

    function _sellPath(
        TradeData memory data,
        uint256 amount,
        address token,
        address strategy
    ) internal {
        uint256 length = data.adapters.length - 1;
        if (amount != 0 && length != uint256(-1)) {
            for (uint256 i = length; ; --i) {
                uint256 _amount;
                address _tokenIn;
                address _tokenOut;
                address _from;
                address _to;
                if (i == length) {
                    _tokenIn = token;
                    _amount = amount;
                    _from = strategy;
                } else {
                    _tokenIn = data.path[i];
                    _from = address(this);
                    _amount = IERC20(_tokenIn).balanceOf(_from);
                }
                if (i == 0) {
                    _tokenOut = weth;
                    _to = strategy;
                } else {
                    _tokenOut = data.path[i-1];
                    _to = address(this);
                }
                _delegateSwap(
                    data.adapters[i],
                    _amount,
                    1,
                    _tokenIn,
                    _tokenOut,
                    _from,
                    _to
                );
                if (i == 0) break;
            }
        }
    }

    function _buyPath(
        TradeData memory data,
        uint256 amount,
        address token,
        address strategy,
        address from
    ) internal {
        if (amount != 0) {
            uint256 length = data.adapters.length;
            for (uint256 i; i < length; ++i) {
                uint256 _amount;
                address _tokenIn;
                address _tokenOut;
                address _from;
                address _to;
                if (i == 0) {
                    _tokenIn = weth;
                    _amount = amount;
                    _from = from;
                } else {
                    _tokenIn = data.path[i-1];
                    _from = address(this);
                    _amount = IERC20(_tokenIn).balanceOf(_from);
                }
                if (i == data.adapters.length-1) {
                    _tokenOut = token;
                    _to = strategy;
                } else {
                    _tokenOut = data.path[i];
                    _to = address(this);
                }
                _delegateSwap(
                    data.adapters[i],
                    _amount,
                    1,
                    _tokenIn,
                    _tokenOut,
                    _from,
                    _to
                );
            }
        }
    }

    function _estimateSellAmount(
        address strategy,
        address token,
        uint256 amount,
        uint256 estimatedValue
    ) internal view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(strategy);
        if (estimatedValue > amount) {
          return balance.mul(amount).div(estimatedValue);
        } else {
          return balance;
        }
    }

    function _getExpectedWeth(
        bytes calldata data
    ) internal pure returns (
        uint256 expectedWeth,
        uint256 total,
        int256[] memory estimates
    ) {
        uint256 percentage;
        (percentage, total, estimates) =
            abi.decode(data, (uint256, uint256, int256[]));
        expectedWeth = total.mul(percentage) / _1e18;
        total = total.sub(expectedWeth);
    }
}
