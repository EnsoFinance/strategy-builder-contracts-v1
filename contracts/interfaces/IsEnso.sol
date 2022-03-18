//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IsEnso {
    function enso() external view returns(IERC20 enso);

    function distributionTokenScalar() external view returns(uint256);
}
