//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "./helpers/StringUtils.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyRouter.sol";
import "./helpers/StrategyTypes.sol";

contract StrategyControllerLens is StringUtils { // TODO make upgradeable

    IStrategyController immutable private _controller; 
    IStrategyProxyFactory immutable private _factory; 
    address immutable private _weth;
    address immutable private _balancerVault;

    enum Operation {
        NONE,
        DEPOSIT,
        CREATE_STRATEGY
    }
    
    // Initialize constructor to disable implementation
    constructor(address controller_, address weth_, address factory_) public /*initializer*/ { // FIXME update initializer
        _controller = IStrategyController(controller_);
        _factory = IStrategyProxyFactory(factory_);
        _weth = weth_;
        _balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    }

    // needed to withdraw weth
    fallback() external payable {}
    receive() external payable {}

    function controller() external view returns(IStrategyController) {
        return _controller;
    }

    // the try reverts every time! only call with callStatic unless you want to pay for gas
    function estimateCreateStrategy(
        uint256 msgValue,
        address manager,
        string memory name,
        string memory symbol,
        StrategyTypes.StrategyItem[] memory strategyItems,
        StrategyTypes.InitialState memory strategyState,
        address router,
        bytes memory data
    ) external returns (string memory value){
        try this._estimateCreateStrategy(msgValue, manager, name, symbol, strategyItems, strategyState, router, data) {
        
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

    // do not call unless you are me!!!
    function _estimateCreateStrategy(
        uint256 msgValue,
        address manager,
        string memory name,
        string memory symbol,
        StrategyTypes.StrategyItem[] memory strategyItems,
        StrategyTypes.InitialState memory strategyState,
        address router,
        bytes memory data
    ) external returns (uint256 value){
        require(msg.sender == address(this), "estimateWithdrawETH: only callable by self.");
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = msgValue;
        address[] memory tokens = new address[](1);
        tokens[0] = _weth;
        data = abi.encodeWithSelector( // reusing variable to avoid stack too deep
            bytes4(keccak256("flashLoan(address,address[],uint256[],bytes)")),
            address(this),
            tokens,
            amounts,
            abi.encode(Operation.CREATE_STRATEGY, msgValue, manager, name, symbol, strategyItems, strategyState, router, data)
        );
        (bool success,) = _balancerVault.call(data);  
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
        // this always reverts -> receiveFlashLoan -> _createStrategy
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

    function _createStrategy(bytes memory userData) private {
        (, 
        uint256 msgValue,
        address manager,
        string memory name,
        string memory symbol,
        StrategyTypes.StrategyItem[] memory strategyItems,
        StrategyTypes.InitialState memory strategyState,
        address router,
        bytes memory data
        ) = abi.decode(userData, (Operation, uint256, address, string, string, StrategyTypes.StrategyItem[], StrategyTypes.InitialState, address, bytes));
        // weth unwrap
        IWETH(_weth).withdraw(msgValue);
        (,uint256 value) = _factory.createStrategy{value: msgValue}(manager, name, symbol, strategyItems, strategyState, router, data);
        revert(toString(value));  // always reverts!!
    }

    function _makeDeposit(bytes memory userData) private {
        (, 
         address strategy, 
         address router, 
         uint256 amount, 
         uint256 slippage, 
         bytes memory data
        ) = abi.decode(userData, (Operation, address, address, uint256, uint256, bytes));
        (bool success,) = _weth.call(abi.encodeWithSelector(
            bytes4(keccak256("approve(address,uint256)")),
            router,
            amount
        ));
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
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
        } else if (op == Operation.CREATE_STRATEGY) {
            _createStrategy(userData); 
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
