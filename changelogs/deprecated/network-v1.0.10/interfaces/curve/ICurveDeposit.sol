//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface ICurveDeposit {
    function curve() external view returns (address);

    function coins(uint256) external view returns (address);

    function coins(int128) external view returns (address);

    function underlying_coins(uint256) external view returns (address);

    function underlying_coins(int128) external view returns (address);

    function calc_withdraw_one_coin(uint256 _token_amount, uint256 i) external view returns (uint256);

    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view returns (uint256);

    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external;

    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount) external;

    function add_liquidity(uint256[4] calldata amounts, uint256 min_mint_amount) external;

    function remove_liquidity(uint256 _amount, uint256[] calldata min_amounts) external;

    function remove_liquidity_one_coin(uint256 _token_amount, uint256 i, uint256 min_amount) external;

    function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 min_amount) external;
}
