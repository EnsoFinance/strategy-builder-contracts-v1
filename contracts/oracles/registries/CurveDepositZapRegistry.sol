//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/registries/ICurveDepositZapRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CurveDepositZapRegistry is ICurveDepositZapRegistry, Ownable {

    mapping(address => address) internal _zaps;

    function getZap(address token) external view override returns (address) {
        return _zaps[token];
    }

    function addZap(address token, address depositZap) external onlyOwner {
        _zaps[token] = depositZap;
    }
}
