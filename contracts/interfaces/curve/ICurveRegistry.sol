//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface ICurveRegistry {
    function find_pool_for_coins(address _from, address _to, uint256 i) external view returns (address);
       
    function get_n_coins(address pool) external view returns (uint256, uint256);

    function get_coins(address pool) external view returns (address[8] memory);

    function get_coin_indices(address pool, address _from, address _to) external view returns (int128, int128, bool);

    function get_pool_asset_type(address pool) external view returns (uint256);

    function get_lp_token(address pool) external view returns (address);

    function get_pool_from_lp_token(address lp) external view returns (address);

    function get_virtual_price_from_lp_token(address lp) external view returns (uint256);
}
