//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./helpers/StringUtils.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyRouter.sol";

contract StrategyControllerLens is StringUtils { // TODO make upgradeable

    IStrategyController immutable private _controller; 
    address immutable private _weth;
    address immutable private _balancerVault;
    
    // Initialize constructor to disable implementation
    constructor(address controller_, address weth_) public /*initializer*/ { // FIXME update initializer
        _controller = IStrategyController(controller_);
        _weth = weth_;
        _balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    }

    function controller() external view returns(IStrategyController) {
        return _controller;
    }

    // the try reverts every time! only call with callStatic unless you want to pay for gas
    function estimateDeposit(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external returns(string memory valueAdded) {
        try this._estimateDeposit(strategy, router, amount, slippage, data) {
        
        } catch (bytes memory reason) {
            if (reason.length != 100) { // length of abi encoded uint256
                assembly {
                    reason := add(reason, 0x04)
                }
                revert(abi.decode(reason, (string)));
            }
            assembly {
                reason := add(reason, 0x04)
            }
            return abi.decode(reason, (string)); // this should be the valueAdded to be decoded
        } 
    }

    enum Operation {
        NONE,
        DEPOSIT
    }

    // do not call unless you are me!!!
    function _estimateDeposit(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external returns(uint256 valueAdded) {
        require(msg.sender == address(this), "estimateWithdrawETH: only callable by self.");
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        address[] memory tokens = new address[](1);
        tokens[0] = _weth;
        bytes memory callData = abi.encodeWithSelector(
            bytes4(keccak256("flashLoan(address,address[],uint256[],bytes)")),
            address(this),
            tokens,
            amounts,
            abi.encode(Operation.DEPOSIT, strategy, router, amount, slippage, data)
        );
        (bool success,) = _balancerVault.call(callData);  
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
        // this always reverts -> receiveFlashLoan -> _makeDeposit
    }

    function _makeDeposit(bytes memory userData) private {
        (, 
         address strategy, 
         address router, 
         uint256 amount, 
         uint256 slippage, 
         bytes memory data
        ) = abi.decode(userData, (Operation, address, address, uint256, uint256, bytes));
        uint256 valueAdded = _controller.deposit(IStrategy(strategy), IStrategyRouter(router), amount, slippage, data);
        revert(toString(valueAdded));  // always reverts!!
    }

    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        Operation op = abi.decode(userData, (Operation)); 
        if (op == Operation.DEPOSIT) {
            _makeDeposit(userData); 
        } else {
            revert("receiveFlashLoan: op not supported.");
        }
    }

    // the try reverts every time! only call with callStatic unless you want to pay for gas
    function estimateWithdrawWETH(
        address account,
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external returns(string memory) {
        try this._estimateWithdrawWETH(strategy, router, amount, slippage, data, account) {
        
        } catch (bytes memory reason) {
            if (reason.length != 100) { // length of abi encoded uint256
                assembly {
                    reason := add(reason, 0x04)
                }
                revert(abi.decode(reason, (string)));
            }
            assembly {
                reason := add(reason, 0x04)
            }
            return abi.decode(reason, (string)); // this should be the wethAmount to be decoded
        } 
    }

    // do not call unless you are me!!!
    function _estimateWithdrawWETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data,
        address msgSender
    ) external returns(uint256) {
        require(msg.sender == address(this), "estimateWithdrawETH: only callable by self.");
        data = abi.encode(msgSender, data);
        uint256 wethAmount = _controller.withdrawWETH(strategy, router, amount, slippage, data);
        revert(toString(wethAmount));  // always reverts!!
    }

}
