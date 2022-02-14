//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/registries/ICurveDepositZapRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CurveDepositZapRegistry is ICurveDepositZapRegistry, Ownable {

    mapping(address => address) internal _zaps;
    mapping(address => uint256) internal _indexType; // 0 = int128, 1 = uint256

    function getZap(address token) external view override returns (address) {
        return _zaps[token];
    }

    function getIndexType(address zap) external view override returns (uint256) {
        return _indexType[zap];
    }

    function addZap(address token, address depositZap, uint256 indexType) external onlyOwner {
        _zaps[token] = depositZap;
        _indexType[depositZap] = indexType;
    }
}
