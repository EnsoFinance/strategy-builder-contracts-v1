//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface ICurveAddressProvider {
    function get_registry() external view returns (address);
}
