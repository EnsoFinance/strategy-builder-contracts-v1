//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../interfaces/IEstimator.sol";

interface Gas {
    function burn() external view returns (int256);
}

contract GasBurnerEstimator is IEstimator {
    function estimateItem(IStrategy, address a, uint256 b) public view override returns (int256) {
        return _estimateItem(a, b);
    }

    function estimateItem(IStrategy, address token) public view override returns (int256) {
        uint256 dummy;
        return _estimateItem(token, dummy);
    }

    function _estimateItem(address, uint256) private view returns (int256) {
        try Gas(address(0)).burn() returns (int256 response) {
          return response;
        } catch {
          return 0;
        }
    }
}
