//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../interfaces/IStrategyProxyFactory.sol";
import "../interfaces/IStrategy.sol";
import "../helpers/Clones.sol";

contract AddressPredictor {
    function predictTokenDeterministicAddress(address strategyFactory, address strategy) public view returns(address) {
        // strategy (proxy) may not exist yet
        IStrategyProxyFactory strategyProxyFactory = IStrategyProxyFactory(strategyFactory);
        bytes32 salt = keccak256(abi.encode(strategy, strategyProxyFactory.version()));
        return Clones.predictDeterministicAddress(IStrategy(strategyProxyFactory.implementation()).tokenImplementationProxy(), salt, strategy);
    }
}
