//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface IERC1155Supply {

    function totalSupply(uint256 id) external view returns(uint256);

}
