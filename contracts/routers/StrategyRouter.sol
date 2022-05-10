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

    function estimateWithdraw(address strategy, bytes calldata data) external view virtual override returns(int256[] memory balances, uint256 updatedStrategyWethBalance) {
        revert("estimateWithdraw: not supported.");
    }

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
                bytes4(
                    keccak256("swap(uint256,uint256,address,address,address,address)")
                ),
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

    function _estimateSwap(
        address adapter,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) internal view returns(uint256 value) {
        // FIXME TODO 
    }

    function _sellPath(
        TradeData memory data,
        uint256 amount,
        address token,
        address strategy
    ) internal {
        if (amount == 0) return;
        uint256 _amount;
        address _tokenIn;
        address _tokenOut;
        address _from;
        address _to;
        for (int256 i = int256(data.adapters.length-1); i >= 0; --i) { //this doesn't work with uint256?? wtf solidity
            (_amount, _tokenIn, _tokenOut, _from, _to) = _prepareSale(data, amount, token, strategy, uint256(i));
            _delegateSwap(
                data.adapters[uint256(i)],
                _amount,
                1,
                _tokenIn,
                _tokenOut,
                _from,
                _to
            );
        }
    }

    // simulates `_sellPath`
    function _estimateSellPath(
        TradeData memory data,
        uint256 amount,
        address token,
        address strategy
    ) internal view returns(uint256 wethAmount) {
        if (amount == 0) return 0;
        uint256 _amount;
        address _tokenIn;
        address _tokenOut;
        address _from;
        address _to;
        for (int256 i = int256(data.adapters.length-1); i >= 0; --i) { //this doesn't work with uint256?? wtf solidity
            (_amount, _tokenIn, _tokenOut, _from, _to) = _prepareSale(data, amount, token, strategy, uint256(i));
            wethAmount = wethAmount.add(_estimateSwap(
                data.adapters[uint256(i)],
                _amount,
                1,
                _tokenIn,
                _tokenOut,
                _from,
                _to
            ));
        }
    }

    function _prepareSale(TradeData memory data, uint256 amount, address token, address strategy, uint256 i) private view returns(uint256 _amount, address _tokenIn, address _tokenOut, address _from, address _to) {
        if (i == data.adapters.length-1) {
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
    }

    function _buyPath(
        TradeData memory data,
        uint256 amount,
        address token,
        address strategy,
        address from
    ) internal {
        if (amount > 0) {
            for (uint256 i = 0; i < data.adapters.length; ++i) {
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
}
