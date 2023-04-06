//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "../../interfaces/aave/IAToken.sol";
import "../../interfaces/aave/IPriceOracleGetter.sol";
import "../../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../../helpers/GasCostProvider.sol";
import "../BaseAdapter.sol";

contract Leverage2XAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable defaultAdapter;
    address public immutable aaveV2Adapter;
    address public immutable aaveV2DebtAdapter;
    address public immutable debtToken; // Token that is being borrowed against collateral
    GasCostProvider public immutable gasCostProvider;

    ILendingPoolAddressesProvider public immutable addressesProvider;
    IPriceOracleGetter private immutable _po;
    bytes32 immutable UNDERLYING_ASSET_ADDRESS_SELECTOR;

    constructor(
        address defaultAdapter_,
        address aaveV2Adapter_,
        address aaveV2DebtAdapter_,
        address addressesProvider_,
        address debtToken_,
        address weth_
    ) public BaseAdapter(weth_) {
        defaultAdapter = defaultAdapter_;
        aaveV2Adapter = aaveV2Adapter_;
        aaveV2DebtAdapter = aaveV2DebtAdapter_;
        debtToken = debtToken_;
        gasCostProvider = new GasCostProvider(6000, msg.sender); // estimated gas cost
        addressesProvider = ILendingPoolAddressesProvider(addressesProvider_);
        _po = IPriceOracleGetter(ILendingPoolAddressesProvider(addressesProvider_).getPriceOracle());
        UNDERLYING_ASSET_ADDRESS_SELECTOR = keccak256("UNDERLYING_ASSET_ADDRESS()");
    }

    // Swap to support 2X leverage called from multicall router
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        require(amount >= expected, "Insufficient tokenOut amount");

        if (from != address(this)){
            uint256 beforeBalance = IERC20(tokenIn).balanceOf(address(this));
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            uint256 afterBalance = IERC20(tokenIn).balanceOf(address(this));
            require(afterBalance > beforeBalance, "No tokens transferred to adapter");
            amount = afterBalance - beforeBalance;
        }

        require(_checkAToken(tokenOut), "Only supports deposit");
        require(IAToken(tokenOut).UNDERLYING_ASSET_ADDRESS() == tokenIn, "Incompatible");
        // Lend all underlying tokens (Amount received will equal amount sent)
        _delegateSwap(aaveV2Adapter, amount, 1, tokenIn, tokenOut, address(this), to);
        // since the aaveV2DebtAdapter values the input as weth
        uint256 wethAmount = _convert(amount, tokenIn, weth);
        //Take out equivalent of 50% debt
        _delegateSwap(aaveV2DebtAdapter, wethAmount >> 1, 1, address(0), debtToken, to, address(this));
        //Trade debt for underlying
        _delegateSwap(defaultAdapter, IERC20(debtToken).balanceOf(address(this)), 1, debtToken, tokenIn, address(this), address(this));
        // Lend all underlying tokens
        _delegateSwap(aaveV2Adapter, IERC20(tokenIn).balanceOf(address(this)), 1, tokenIn, tokenOut, address(this), to);
        //Take out equivalent of 50% debt (should be able to borrow another 50% since we've added to our reserve)
        _delegateSwap(aaveV2DebtAdapter, wethAmount >> 1, 1, address(0), debtToken, to, address(this));
        //Trade debt for underlying
        _delegateSwap(defaultAdapter, IERC20(debtToken).balanceOf(address(this)), 1, debtToken, tokenIn, address(this), address(this));
        // Lend all underlying tokens
        _delegateSwap(aaveV2Adapter, IERC20(tokenIn).balanceOf(address(this)), expected, tokenIn, tokenOut, address(this), to);
    }

    function _delegateSwap(
        address adapter,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) internal {
        //No need to check adapters since they are set at time of deployment and can't be changed
        bool success;
        bytes memory swapData =
            abi.encodeWithSelector(
                IBaseAdapter.swap.selector,
                amount,
                expected,
                tokenIn,
                tokenOut,
                from,
                to
            );
        uint256 txGas = gasleft();
        assembly {
            success := delegatecall(txGas, adapter, add(swapData, 0x20), mload(swapData), 0, 0)
        }
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }

    function _checkAToken(address token) internal view returns (bool) {
        bytes32 selector = UNDERLYING_ASSET_ADDRESS_SELECTOR;
        uint256 gasCost = gasCostProvider.gasCost();

        bool success;
        address underlying;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 32))
            mstore(ptr, selector)
            success := staticcall(
                gasCost,
                token,
                ptr,
                4,
                ptr,
                32
            )
            underlying := mload(ptr)
        }
        return success && underlying != address(0);
    }

    function _convert(uint256 amount, address tokenIn, address tokenOut) internal view returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        if (tokenIn == weth) {
            return amount.mul(10**uint256(IERC20NonStandard(tokenOut).decimals())).div(_po.getAssetPrice(tokenOut));
        } else if (tokenOut == weth) {
            return amount.mul(_po.getAssetPrice(tokenIn)) / 10**uint256(IERC20NonStandard(tokenIn).decimals());
        } else {
            return (amount.mul(_po.getAssetPrice(tokenIn))
                       .mul(10**uint256(IERC20NonStandard(tokenOut).decimals()))
                       / 10**uint256(IERC20NonStandard(tokenIn).decimals()))
                       .div(_po.getAssetPrice(tokenOut));
        }
    }
}
