//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/compound/ICToken.sol";
import "../../interfaces/compound/IComptroller.sol";
import "../../libraries/Exponential.sol";

contract CompoundEstimator is IEstimator, Exponential {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return _estimateItem(balance, token);
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        uint256 balance = IERC20(token).balanceOf(address(user));

        return int256(_estimateUnclaimedComp(user, token)).add(_estimateItem(balance, token));
    }

    function _estimateItem(uint256 balance, address token) private view returns (int256) {
        address underlyingToken = ICToken(token).underlying();
        uint256 share = balance.mul(ICToken(token).exchangeRateStored()).div(10**18);
        return IOracle(msg.sender).estimateItem(share, underlyingToken);
    }

    function _estimateUnclaimedComp(address user, address token) private view returns(uint256 unclaimedComp) {
        Exp memory marketBorrowIndex = Exp({mantissa: ICToken(token).borrowIndex()}); 
        IComptroller comptroller = IComptroller(ICToken(token).comptroller());

        Double memory borrowIndex = Double({mantissa: comptroller.compBorrowState(token).index});
        Double memory borrowerIndex = Double({mantissa: comptroller.compBorrowerIndex(token, user)});
        if (borrowerIndex.mantissa > 0) {
            Double memory deltaIndex = sub_(borrowIndex, borrowerIndex);
            uint borrowerAmount = div_(ICToken(token).borrowBalanceStored(user), marketBorrowIndex);
            uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
            unclaimedComp = add_(comptroller.compAccrued(user), borrowerDelta);
        }


        //compSupplyState
        //compSupplyIndex
        // TODO
        /*
            refer to compound's 

           compSupplyState
           compSupplyIndex
           compAccrued

           mimic their internal logic here and expose an estimate function 
           will know comp owed per cToken

           then estimate comp

           note: comp already held by strategy will be estimated as additional step in enso oracle estimateStrategy
        
        **/
    }
}
