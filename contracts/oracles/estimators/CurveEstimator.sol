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
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address public constant SBTC = 0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6;
    address public constant SUSD = 0x57Ab1ec28D129707052df4dF418D58a2D46d5f51;
    address public constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address public constant TRICRYPTO2 = 0xc4AD29ba4B3c580e6D59105FFf484999997675Ff;
    address public constant TRICRYPTO2_POOL = 0xD51a44d3FaE010294C616388b506AcdA1bfAAE46;



    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        if (token == TRICRYPTO2) { //Hack because tricrypto2 is not registered
            address[8] memory coins;
            coins[0] = USDT;
            coins[1] = WBTC;
            coins[2] = WETH;
            int256 value = _estimateCryptoPool(TRICRYPTO2_POOL, coins, 3);
            int256 totalSupply = int256(IERC20(token).totalSupply());
            return value.mul(int256(balance)).div(totalSupply);
        } else {
            ICurveRegistry registry = ICurveRegistry(ADDRESS_PROVIDER.get_registry());
            address pool = registry.get_pool_from_lp_token(token);
            uint256 assetType = registry.get_pool_asset_type(pool);
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
            } else if (assetType == 4) {
                // Crypto
                (uint256 coinsInPool, ) = registry.get_n_coins(pool);
                address[8] memory coins = registry.get_coins(pool);
                int256 value = _estimateCryptoPool(pool, coins, coinsInPool);
                int256 totalSupply = int256(IERC20(token).totalSupply());
                return value.mul(int256(balance)).div(totalSupply);
            }
        }
    }

    function _estimateCryptoPool(address pool, address[8] memory coins, uint256 coinsInPool) private view returns (int256) {
        int256 sumValue = 0;
        for (uint256 i = 0; i < coinsInPool; i++) {
            address underlyingToken = coins[i];
            sumValue = sumValue.add(IOracle(msg.sender).estimateItem(IERC20(underlyingToken).balanceOf(pool), underlyingToken));
        }
        return sumValue;
    }
}
