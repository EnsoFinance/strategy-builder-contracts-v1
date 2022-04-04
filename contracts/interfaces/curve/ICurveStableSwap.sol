//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface ICurveStableSwap {
    function coins(uint256) external view returns (address);

    function coins(int128) external view returns (address);

    function underlying_coins(uint256) external view returns (address);

    function underlying_coins(int128) external view returns (address);

    function get_virtual_price() external view returns (uint256);

    function get_dy_underlying(int128 i, int128 j, uint256 dx) external view returns(uint256 dy);

    function get_dy(int128 i, int128 j, uint256 dx) external view returns(uint256 dy);

    function calc_token_amount(uint256[2] calldata amounts, bool deposit) external view returns (uint256);

    function calc_token_amount(uint256[3] calldata amounts, bool deposit) external view returns (uint256);

    function calc_token_amount(uint256[4] calldata amounts, bool deposit) external view returns (uint256);

    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy) external;

    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external;

    function exchange_underlying(uint256 i, uint256 j, uint256 dx, uint256 minDy) external;

    function exchange_underlying(int128 i, int128 j, uint256 dx, uint256 minDy) external;

    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external;

    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount) external;

    function add_liquidity(uint256[4] calldata amounts, uint256 min_mint_amount) external;

    function remove_liquidity(uint256 _amount, uint256[] calldata min_amounts) external;
}
