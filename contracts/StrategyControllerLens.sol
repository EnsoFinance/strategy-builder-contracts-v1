//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./helpers/StringUtils.sol";
import "./interfaces/IStrategyController.sol";

contract StrategyControllerLens is StringUtils { // TODO make upgradeable

    IStrategyController immutable private _controller; 
    
    // Initialize constructor to disable implementation
    constructor(address controller_) public /*initializer*/ { // FIXME update initializer
        _controller = IStrategyController(controller_);
    }

    function controller() external view returns(IStrategyController) {
        return _controller;
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

    // reverts every time! only call with callStatic unless you want to pay for gas
    function estimateWithdrawWETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external returns(string memory) {
        try this._estimateWithdrawWETH(strategy, router, amount, slippage, data, msg.sender) {
        
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
}
