//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;


interface IPortfolioInitializer {
    function initialize(
        address owner_,
        address oracle_,
        address whitelist_,
        address controller_,
        string memory name_,
        string memory symbol_,
        uint256 version_,
        address[] memory tokens_,
        uint256[] memory percentages_
    ) external payable returns (bool);
}


contract PortfolioProxyInitializer {
    address private immutable proxyFactory;

    constructor(address proxyFactory_) public {
        proxyFactory = proxyFactory_;
    }

    function initialize(
        address proxy,
        address owner_,
        address oracle_,
        address whitelist_,
        address controller_,
        string memory name_,
        string memory symbol_,
        uint256 version_,
        address[] memory tokens_,
        uint256[] memory percentages_
    ) external payable {
        require(msg.sender == proxyFactory, "PortfolioProxyInitializer.initialize: Only factory may call initialize");
        IPortfolioInitializer(proxy).initialize{value: msg.value}( //solhint-disable-line
            owner_,
            oracle_,
            whitelist_,
            controller_,
            name_,
            symbol_,
            version_,
            tokens_,
            percentages_
        );
    }
}
