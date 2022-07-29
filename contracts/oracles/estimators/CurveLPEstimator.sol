//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../helpers/StrategyTypes.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "../../interfaces/curve/ICurveCrypto.sol";
import "../../interfaces/curve/ICurveStableSwap.sol";
import "../../interfaces/curve/ICurveRegistry.sol";
import "../../interfaces/curve/ICurveDeposit.sol";

interface IAddressProvider {
    function get_registry() external view returns (address);
}

contract CurveLPEstimator is IEstimator, IEstimatorKnowing {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IAddressProvider public constant ADDRESS_PROVIDER = IAddressProvider(0x0000000022D53366457F9d5E68Ec105046FC4383);
    address public constant SBTC = 0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6;
    address public constant SUSD = 0x57Ab1ec28D129707052df4dF418D58a2D46d5f51;
    address public constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address public constant TRICRYPTO2 = 0xc4AD29ba4B3c580e6D59105FFf484999997675Ff;
    address public constant TRICRYPTO2_ORACLE = 0xE8b2989276E2Ca8FDEA2268E3551b2b4B2418950;
    uint256 private constant TRICRYPTO2_PRECISION = 10**30; // lpPrice_precision + (lp_precision - usdt_precision) = 18 + (18 - 6) = 30
    uint256 private immutable _1e18;

    constructor() public {
        _1e18 = 10**18;
    }

    function estimateItem(
        IStrategy strategy,
        address token
    ) public view override returns (int256) {
        uint256 balance = IERC20(token).balanceOf(address(strategy));
        return estimateItem(strategy, token, balance);
    }

    function estimateItem(
        IStrategy strategy,
        address token,
        uint256 balance
    ) public view override returns (int256) {
        address underlyingToken;
        if (address(strategy) != address(0)) {
            StrategyTypes.TradeData memory td = strategy.getTradeData(token);
            if (td.path.length != 0) underlyingToken = td.path[td.path.length - 1];
        }
        return estimateItem(strategy, token, underlyingToken, balance);
    }

    function estimateItem(
        IStrategy strategy,
        address token,
        address underlyingToken,
        uint256 balance
    ) public view override returns (int256) {
        if (balance == 0) return 0;
        if (token == TRICRYPTO2) { //Hack because tricrypto2 is not registered
            uint256 lpPrice = ICurveCrypto(TRICRYPTO2_ORACLE).lp_price();
            return IOracle(msg.sender).estimateItem(strategy, USDT, lpPrice.mul(balance)/ TRICRYPTO2_PRECISION);
        } else {
            ICurveRegistry registry = ICurveRegistry(ADDRESS_PROVIDER.get_registry());
            address pool = registry.get_pool_from_lp_token(token);
            uint256 assetType = registry.get_pool_asset_type(pool);
            if (assetType < 4) {
                address[8] memory coins = registry.get_coins(pool);
                // attempt more accurate estimate first
                if (underlyingToken != address(0)) {
                    uint256 idx = uint256(-1);
                    for (uint256 i; coins[i] != address(0) && i < 8; ++i) {
                        require(coins[i] != address(0), "Token not found in pool");
                        if(coins[i] == underlyingToken){
                            idx = i;
                            break;
                        }
                    }
                    if (idx != uint256(-1)) {
                        try ICurveDeposit(pool).calc_withdraw_one_coin(balance, int128(idx)) returns(uint256 _balance) {
                            return IOracle(msg.sender).estimateItem(strategy, underlyingToken, _balance);
                        } catch {
                            // continue to less accurate estimate
                        }
                    }
                }
                // fall back to less accurate estimate
                uint256 virtualPrice = registry.get_virtual_price_from_lp_token(token);
                uint256 virtualBalance =
                    balance.mul(
                        virtualPrice
                    ) / _1e18;
                if (assetType == 0) {
                    // USD
                    return IOracle(msg.sender).estimateItem(strategy, SUSD, virtualBalance);
                } else if (assetType == 1) {
                    // ETH
                    return int256(virtualBalance);
                } else if (assetType == 2) {
                    // BTC
                    return IOracle(msg.sender).estimateItem(strategy, SBTC, virtualBalance);
                } else {
                    // Other (Link or Euro)
                    // less accurate
                    for (uint256 i; coins[i] != address(0) && i < 8; ++i) {
                        underlyingToken = coins[i];
                        uint256 decimals = uint256(IERC20NonStandard(underlyingToken).decimals());
                        uint256 convertedBalance = virtualBalance;
                        if (decimals < 18) {
                          convertedBalance = convertedBalance / 10**(18-decimals);
                        } else if (decimals > 18) {
                          convertedBalance = convertedBalance.mul(10**(decimals-18));
                        }
                        try IOracle(msg.sender).estimateItem(strategy, underlyingToken, convertedBalance) returns (int256 value) {
                            if (value > 0) {
                              return value;
                            }
                        } catch (bytes memory) {
                            continue;
                        }
                    }
                    revert("Asset not found");
                }
            } else {
                // Other crypto pools
                revert("Not supported");
            }
        }
    }

}
