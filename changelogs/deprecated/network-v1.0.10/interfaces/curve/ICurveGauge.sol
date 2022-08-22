//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface ICurveGauge {
    function MAX_REWARDS() external view returns (uint256);

    function curve_token() external view returns (address);

    function lp_token() external view returns (address);

    function reward_tokens(uint256 i) external view returns (address);

    function deposit(uint256 _value, address _addr) external;

    function withdraw(uint256 _value) external;

    function claim_rewards(address _addr) external;
}
