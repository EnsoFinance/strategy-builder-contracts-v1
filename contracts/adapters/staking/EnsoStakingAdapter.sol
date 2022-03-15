//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";
import "../BaseAdapter.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/IRewardsAdapter.sol";
import "../../interfaces/IStaking.sol";
import "../../interfaces/IERC1155Supply.sol";

contract EnsoStakingAdapter is BaseAdapter, IRewardsAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable staking;

    address public immutable stakedToken;
    address public immutable distributionToken;

    uint256 public immutable distributionTokenScalar;

    event RewardsClaimed(address from, address to, address token, uint256 amount);

    constructor(
        address staking_,
        address stakedToken_,
        address distributionToken_,
        uint256 distributionTokenScalar_,
        address weth_
    ) BaseAdapter(weth_) public {
        staking = staking_;
        stakedToken = stakedToken_; 
        distributionToken = distributionToken_;
        require(distributionTokenScalar_ > 0, "EnsoStakingAdapter: invalid scaled distribution scalar.");
        distributionTokenScalar = distributionTokenScalar_;
    }

    // @notice Calculates the stakedToken minted by staking
    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        require(tokenIn != tokenOut, "spotPrice: tokens cannot match.");
        require(tokenIn == stakedToken || tokenIn == distributionToken, "spotPrice: invalid `tokenIn`.");
        require(tokenOut == stakedToken || tokenOut == distributionToken, "spotPrice: invalid `tokenOut`.");
        return (tokenIn == stakedToken) ? amount.mul(distributionTokenScalar) : amount.div(distributionTokenScalar);
    }
  
    // @dev: stakes and unstakes stakedToken on behalf of `to` 
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "swap: tokens cannot match.");
        if (tokenIn == stakedToken) {
            require(tokenOut == distributionToken, "swap: invalid `tokenOut`.");
            if (from != address(this))
              IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            uint256 toBalanceBefore = IERC20(tokenOut).balanceOf(to);
            IStaking(staking).stakeFor(to, SafeCast.toUint128(amount)); // ignores `hoursToStake` TODO suggest removal from interface
            uint256 toBalanceAfter = IERC20(tokenOut).balanceOf(to);
            uint256 difference = toBalanceAfter.sub(toBalanceBefore);
            require(difference >= expected, "swap: Insufficient tokenOut amount");
        } else if (tokenIn == distributionToken) {
            require(tokenOut == stakedToken, "swap: invalid `tokenOut`.");
            if (from != address(this))
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            uint256 toBalanceBefore = IERC20(tokenOut).balanceOf(to);
            IStaking(staking).unstakeFor(to);
            uint256 toBalanceAfter = IERC20(tokenOut).balanceOf(to);
            uint256 difference = toBalanceAfter.sub(toBalanceBefore);
            require(difference >= expected, "swap: Insufficient tokenOut amount");
        } else {
            revert("swap: token not supported.");
        }
    }

    // Intended to be called via delegateCall
    function claim(address token) external override {
      uint256 owed = IStaking(IStaking(staking).distribution()).claim(token); 
      // uint256 owed = IStaking(staking).claim(token); // FIXME update after `Staking` is refactored to inherit `RewardDistribution`
      emit RewardsClaimed(staking, address(this), token, owed);
    }

}
