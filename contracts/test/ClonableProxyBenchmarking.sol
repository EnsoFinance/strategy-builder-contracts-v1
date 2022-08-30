//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../implementations/recovery/StrategyControllerPaused.sol";

import "../StrategyController.sol";
import "../interfaces/IStrategyController.sol";
import "../helpers/Clones.sol";
import "../helpers/ClonableTransparentUpgradeableProxy.sol";

contract ClonableProxyBenchmarking {

    address private _exampleImplementation;
    address private _clonableUpgradeableProxy;

    address private _clone;

    constructor() public {
       _exampleImplementation = address(new StrategyControllerPaused(address(this))); 
       _clonableUpgradeableProxy = address(new ClonableTransparentUpgradeableProxy(_exampleImplementation, address(0)));
       _clone = address(1); // make slot hot so there won't be bias in test
    }

    function cloneNaked() external {
        address clone = Clones.clone(_exampleImplementation); 
    }

    function cloneNakedAndInitialize() external {
        address clone = Clones.clone(_exampleImplementation); 
        IStrategyController(clone).initialize();
        _clone = clone;
    }

    function cloneProxy() external {
        address clone = Clones.clone(_clonableUpgradeableProxy); 
    }

    function cloneProxyAndInitialize() external {
        address clone = Clones.clone(_clonableUpgradeableProxy); 
        IClonableTransparentUpgradeableProxy(clone).initialize(_exampleImplementation, msg.sender);
        IStrategyController(clone).initialize();
        _clone = clone;
    }

    function callFn() external {
        address oracle = address(IStrategyController(_clone).oracle()); 
    }
}
