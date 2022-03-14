//SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../BaseAdapter.sol";
import "../../interfaces/IRewardsAdapter.sol";
import "../../interfaces/IERC1155Supply.sol";

pragma solidity 0.6.12;

contract StakingAdapter is BaseAdapter, IRewardsAdapter {
    using SafeMath for uint256;

    address public immutable staking;
    address public immutable distributionToken;

    address public immutable stakedToken;

    uint256 public distributionTokenScalar;

    DistributionType public distributionType;

    enum DistributionType {Scaled, Proportion, ProportionERC1155Supply}

    constructor(
        address stakedToken_,
        address staking_,
        address distributionToken_,
        address weth_,
        uint256 distributionTokenScalar_,
        DistributionType distributionType_
    ) BaseAdapter(weth_) public {
        staking = staking_;
        distributionToken = distributionToken_;
        stakedToken = stakedToken_; 
        require(!(distributionType == DistributionType.Scaled && distributionTokenScalar_ < 0), "StakingAdapter: invalid scaled distribution scalar.");
        distributionTokenScalar = distributionTokenScalar_;
        distributionType = distributionType_;
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
        if (distributionType == DistributionType.Scaled) {
            return (tokenIn == stakedToken) ? amount.mul(distributionTokenScalar) : amount.div(distributionTokenScalar);
        } else if (distributionType == DistributionType.Proportion) {
            return (tokenIn == stakedToken) ? amount.div(IERC20(distributionToken).totalSupply()) : amount.mul(IERC20(distributionToken).totalSupply()); // TODO normalize 
        } else if (distributionType == DistributionType.ProportionERC1155Supply) {
            uint256 id; // TODO
            return (tokenIn == stakedToken) ? amount.div(IERC1155Supply(distributionToken).totalSupply(id)) : amount.mul(IERC1155Supply(distributionToken).totalSupply(id)); 
            // TODO normalize
        } else {
          revert("spotPrice: distributionType not supported.");
        }
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
