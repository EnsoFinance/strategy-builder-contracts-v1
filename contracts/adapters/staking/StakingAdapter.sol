//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

contract StakingAdapter is BaseAdapter, IRewardsAdapter {

    /// @notice Staking contract address
    address public immutable staking;

    /// @notice Enso token address
    address public immutable stakedToken;

    uint256 public constant DISTRIBUTION_TOKEN_SCALAR = uint256(10);

    constructor(
        address stakedToken_,
        address staking_,
        address weth
    ) BaseAdapter(weth_) {
        staking = staking_;
        stakedToken = stakedToken_; 
    }

    // @notice Calculates the sEnso minted by staking
    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        require(tokenIn != tokenOut, "spotPrice: tokens cannot match.");
        require(tokenIn == stakedToken || tokenIn == staking.distribution(), "spotPrice: invalid `tokenIn`.");
        require(tokenOut == stakedToken || tokenOut == staking.distribution(), "spotPrice: invalid `tokenOut`.");
        return (tokenIn == ensoErc20) ? amount.mul(DISTRIBUTION_TOKEN_SCALAR) : amount.div(DISTRIBUTION_TOKEN_SCALAR);
    }
  
    // @dev:  // TODO
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
    }

    // Intended to be called via delegateCall
    function claim(address token) external override {
    }

}
