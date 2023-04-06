//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "./helpers/StringUtils.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyRouter.sol";
import "./helpers/StrategyTypes.sol";
import "./libraries/SafeERC20.sol";

contract StrategyControllerLensProxy is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) public {}
}

contract StrategyControllerLens is StringUtils, Initializable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public platformProxyAdmin;
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
    constructor(address controller_, address weth_, address factory_) public initializer {
        _controller = IStrategyController(controller_);
        _factory = IStrategyProxyFactory(factory_);
        _weth = weth_;
        _balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    }

    function initialize() external initializer returns (bool) {}

    // needed to withdraw weth
    fallback() external payable {}
    receive() external payable {}

    function controller() external view returns(IStrategyController) {
        return _controller;
    }

    // the try reverts every time! only call with callStatic unless you want to pay for gas
    function estimateCreateStrategy(
        uint256 msgValue,
        string memory name,
        string memory symbol,
        StrategyTypes.StrategyItem[] memory strategyItems,
        StrategyTypes.InitialState memory strategyState,
        address router,
        bytes memory data
    ) external returns (string memory value){
        try this._estimateCreateStrategy(msgValue, name, symbol, strategyItems, strategyState, router, data) { // _estimateCreateStrategy always reverts by design!!
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
        revert("should never happen."); 
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
        revert("should never happen."); 
    }

    // reverts everytime. only call with callStatic unless you want to pay for gas
    //   Always cancel approves aftewards
    function estimateWithdrawWETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external returns(string memory) {
        IERC20(address(strategy)).safeTransferFrom(msg.sender, address(this), amount); 
        try this._estimateWithdrawWETH(strategy, router, amount, slippage, data) {
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
        revert("should never happen."); 
    }
    
    // callable only by self START

    // do not call unless you are me!!!
    function _estimateCreateStrategy(
        uint256 msgValue,
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
            abi.encode(Operation.CREATE_STRATEGY, msgValue, name, symbol, strategyItems, strategyState, router, data)
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
        revert("should never happen");
    }

    // always reverts by design!!
    function _createStrategy(bytes memory userData) private {
        (, 
        uint256 msgValue,
        string memory name,
        string memory symbol,
        StrategyTypes.StrategyItem[] memory strategyItems,
        StrategyTypes.InitialState memory strategyState,
        address router,
        bytes memory data
        ) = abi.decode(userData, (Operation, uint256, string, string, StrategyTypes.StrategyItem[], StrategyTypes.InitialState, address, bytes));
        // weth unwrap
        IWETH(_weth).withdraw(msgValue);
        _factory.createStrategy{value: msgValue}(name, symbol, strategyItems, strategyState, router, data);
        address strategy = _factory.predictStrategyAddress(address(this), name, symbol); 
        (uint256 value,) = _controller.oracle().estimateStrategy(IStrategy(strategy));
        revert(toString(value));  // always reverts!!
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
        revert("should never happen.");
    }

    function _makeDeposit(bytes memory userData) private {
        (, 
         address strategy, 
         address router, 
         uint256 amount, 
         uint256 slippage, 
         bytes memory data
        ) = abi.decode(userData, (Operation, address, address, uint256, uint256, bytes));
        IERC20(_weth).approve(router, amount);
        (uint256 valueBefore,) = _controller.oracle().estimateStrategy(IStrategy(strategy));
        _controller.deposit(IStrategy(strategy), IStrategyRouter(router), amount, slippage, data);
        (uint256 valueAfter,) = _controller.oracle().estimateStrategy(IStrategy(strategy));
        uint256 valueAdded = valueAfter.sub(valueBefore);
        revert(toString(valueAdded));  // always reverts!!
    }

    // do not call unless you are me!!!
    function _estimateWithdrawWETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external returns(string memory) {
        require(msg.sender == address(this), "estimateWithdrawWETH: only callable by self.");
        uint256 balanceBefore = IERC20(_weth).balanceOf(address(this));
        _controller.withdrawWETH(strategy, router, amount, slippage, data);
        uint256 balanceAfter = IERC20(_weth).balanceOf(address(this));
        uint256 wethAmount = balanceAfter.sub(balanceBefore);
        revert(toString(wethAmount)); // always reverts!!
    }

    // callable only by self END

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
}
