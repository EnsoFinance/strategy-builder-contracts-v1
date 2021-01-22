//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;


interface IPortfolioInitializer {
    function initialize(
        address factory_,
        address owner_,
        string memory name_,
        string memory symbol_,
        address[] memory routers_,
        address[] memory tokens_,
        uint256[] memory percentages_,
        uint256 threshold_,
        uint256 slippage_,
        uint256 timelock_
    ) external payable returns (bool);
}


contract PortfolioProxyInitializer {
    address private immutable proxyFactory;

    constructor(address proxyFactory_) public {
        proxyFactory = proxyFactory_;
    }

    function initialize(
        address proxy,
        address owner,
        string memory name,
        string memory symbol,
        address[] memory routers,
        address[] memory tokens,
        uint256[] memory percentages,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock
    ) external payable {
        require(msg.sender == proxyFactory, "PortfolioProxyInitializer.initialize: Only factory may call initialize");
        IPortfolioInitializer(proxy).initialize{value: msg.value}( //solhint-disable-line
            proxyFactory,
            owner,
            name,
            symbol,
            routers,
            tokens,
            percentages,
            threshold,
            slippage,
            timelock
        );
    }
}
