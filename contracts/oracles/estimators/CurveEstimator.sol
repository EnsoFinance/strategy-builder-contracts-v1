//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "../../interfaces/curve/ICurveStableSwap.sol";
import "../../interfaces/curve/ICurveRegistry.sol";

interface IAddressProvider {
    function get_registry() external view returns (address);
}

contract CurveEstimator is IEstimator {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IAddressProvider public constant ADDRESS_PROVIDER = IAddressProvider(0x0000000022D53366457F9d5E68Ec105046FC4383);
    address public constant SUSD = 0x57Ab1ec28D129707052df4dF418D58a2D46d5f51;
    address public constant SBTC = 0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6;
    address public constant TRICRYPTO2 = 0xc4AD29ba4B3c580e6D59105FFf484999997675Ff;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        ICurveRegistry registry = ICurveRegistry(ADDRESS_PROVIDER.get_registry());
        address pool = registry.get_pool_from_lp_token(token);
        uint256 assetType = registry.get_pool_asset_type(pool);
        if (token == TRICRYPTO2 || assetType == 4) { //Hack because curve has wrong asset type for tricrypto2
            // Crypto
            (uint256 coinsInPool, ) = registry.get_n_coins(pool);
            address[8] memory coins = registry.get_coins(pool);
            int256 sumValue = 0;
            for (uint256 i = 0; i < coinsInPool; i++) {
                address underlyingToken = coins[i];
                sumValue = sumValue.add(IOracle(msg.sender).estimateItem(IERC20(underlyingToken).balanceOf(pool), underlyingToken));
            }
            int256 totalSupply = int256(IERC20(token).totalSupply());
            int256 amount = sumValue.mul(int256(balance)).div(totalSupply);
            return amount;
        } else {
            uint256 virtualPrice = registry.get_virtual_price_from_lp_token(token);
            uint256 virtualBalance =
                balance.mul(
                    virtualPrice
                ).div(10**18);
            if (assetType == 0) {
                // USD
                return IOracle(msg.sender).estimateItem(virtualBalance, SUSD);
            } else if (assetType == 1) {
                // ETH
                return int256(virtualBalance);
            } else if (assetType == 2) {
                // BTC
                return IOracle(msg.sender).estimateItem(virtualBalance, SBTC);
            } else if (assetType == 3) {
                // Other (Link or Euro)
                (uint256 coinsInPool, ) = registry.get_n_coins(pool);
                address[8] memory coins = registry.get_coins(pool);
                for (uint256 i = 0; i < coinsInPool; i++) {
                    address underlyingToken = coins[i];
                    int256 value = IOracle(msg.sender).estimateItem(virtualBalance, underlyingToken);
                    if (value > 0) {
                      return value;
                    }
                }
            }
        }
    }
}
