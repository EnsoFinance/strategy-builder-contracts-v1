//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface IStrategyManager {
    function manager() external view returns (address);
}

contract StrategyProxyManagerRegistry {
    address private immutable proxyFactory;

    constructor(address proxyFactory_) public {
        proxyFactory = proxyFactory_;
    }

    function manager(address proxy) external view returns (address) {
        return IStrategyManager(proxy).manager();
    }
}
