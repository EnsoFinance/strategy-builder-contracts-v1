//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";

contract ProxyHarness {

    TransparentUpgradeableProxy public proxy;

    constructor(address proxy_) public {
        proxy = TransparentUpgradeableProxy(payable(proxy_)); 
    }

    function test() external {
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("test()")));
        (bool success, bytes memory res) = address(proxy).call(data);
        if (!success) {
            revert(string(res));
        }
    }
}
