//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IRewardsEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/compound/ICToken.sol";
import "../../interfaces/compound/IComptroller.sol";
import "../../libraries/Exponential.sol";

import "hardhat/console.sol";

contract CompoundEstimator is IEstimator, IRewardsEstimator, Exponential {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return _estimateItem(balance, token);
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        uint256 balance = IERC20(token).balanceOf(address(user));
        return _estimateItem(balance, token);
    }

    function estimateUnclaimedRewards(address user, address token) external view override returns(int256) {
        return _estimateUnclaimedComp(user, token); 
    }

    function _estimateItem(uint256 balance, address token) private view returns (int256) {
        address underlyingToken = ICToken(token).underlying();
        uint256 share = balance.mul(ICToken(token).exchangeRateStored()).div(10**18);
        return IOracle(msg.sender).estimateItem(share, underlyingToken);
    }

    function _estimateUnclaimedComp(address user, address token) private view returns(int256) {
        Exp memory marketBorrowIndex = Exp({mantissa: ICToken(token).borrowIndex()}); 
        IComptroller comptroller = IComptroller(ICToken(token).comptroller());
        uint256 unclaimedComp;
        Double memory deltaIndex;
        {
            // borrower 
            Double memory borrowIndex = Double({mantissa: comptroller.compBorrowState(token).index});
            
            Double memory borrowerIndex = Double({mantissa: comptroller.compBorrowerIndex(token, user)});
            if (borrowerIndex.mantissa > 0) {
                deltaIndex = sub_(borrowIndex, borrowerIndex);
                uint borrowerAmount = div_(ICToken(token).borrowBalanceStored(user), marketBorrowIndex);
                uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
                unclaimedComp = add_(comptroller.compAccrued(user), borrowerDelta);
            }
        }
        // supplier
        Double memory supplyIndex = Double({mantissa: comptroller.compSupplyState(token).index});
        
        Double memory supplierIndex = Double({mantissa: comptroller.compSupplierIndex(token, user)});
        if (supplierIndex.mantissa == 0 && supplyIndex.mantissa > 0) {
            supplierIndex.mantissa = 1e36; // compInitialIndex;
        }
        deltaIndex = sub_(supplyIndex, supplierIndex);
        uint256 supplierTokens = IERC20(token).balanceOf(user);
        uint256 supplierDelta = mul_(supplierTokens, deltaIndex);
        unclaimedComp = unclaimedComp.add(add_(comptroller.compAccrued(user), supplierDelta));

        int256 estimate = IOracle(msg.sender).estimateItem(unclaimedComp, comptroller.getCompAddress());
        
        console.log(uint256(estimate));
        return estimate;
        // note: comp already held by strategy will be estimated as additional step in enso oracle estimateStrategy
    }
}
