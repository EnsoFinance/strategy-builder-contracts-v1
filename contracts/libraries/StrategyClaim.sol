//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IRewardsAdapter.sol";
import "../interfaces/IStrategyProxyFactory.sol";
import "../helpers/StrategyTypes.sol";
import "./BinaryTree.sol";
import "./MemoryMappings.sol";

library StrategyClaim {
    using MemoryMappings for BinaryTree.Tree;
    using MemoryMappings for BinaryTreeWithPayload.Tree;

    uint256 internal constant PRECISION = 10**18;

    event RewardsClaimed(address indexed adapter, address[] indexed tokens);

    function claimAll(bytes[] calldata claimables) public {
        address[] memory tokens;
        StrategyTypes.TradeData memory tradeData;
        uint256 adaptersLength;
        address rewardsAdapter;
        for (uint256 i; i < claimables.length; ++i) {
            (tokens) = abi.decode(claimables[i], (address[]));
            tradeData = IStrategy(address(this)).getTradeData(tokens[0]); // the tokens are grouped by rewardsAdapter
            adaptersLength = tradeData.adapters.length;
            if (adaptersLength < 1) continue;
            rewardsAdapter = tradeData.adapters[adaptersLength - 1];
            _delegateClaim(rewardsAdapter, tokens);
        }
    }

    function getAllRewardTokens(ITokenRegistry tokenRegistry) public view returns(address[] memory rewardTokens) {
        (uint256[] memory keys, bytes[] memory values) = getAllToClaim(tokenRegistry);
        IRewardsAdapter rewardsAdapter;
        address[] memory claimableTokens;
        address[] memory _rewardTokens;
        address rewardToken;
        BinaryTree.Tree memory exists = BinaryTree.newNode();
        for (uint256 i; i < values.length; ++i) {
            rewardsAdapter = IRewardsAdapter(address(keys[i]));
            (claimableTokens) = abi.decode(values[i], (address[]));
            for (uint256 j; j < claimableTokens.length; ++j) {
                _rewardTokens = rewardsAdapter.rewardsTokens(claimableTokens[j]);
                for (uint256 k; k < _rewardTokens.length; ++k) {
                    rewardToken = _rewardTokens[k];
                    if (!BinaryTree.replace(exists, uint256(rewardToken))) continue;
                    assembly {
                        mstore(add(rewardTokens, add(mul(mload(rewardTokens), 32), 32)), rewardToken)
                        mstore(rewardTokens, add(mload(rewardTokens), 1))
                    }
                }
            }
        }
    }

    function getWithdrawAmounts(
        uint256 percentage,
        address[] memory items,
        address[] memory synths,
        IERC20 weth,
        IERC20 susd
    ) public view returns (
        IERC20[] memory tokens,
        uint256[] memory amounts
    ) {
        uint256 itemsLength = items.length;
        uint256 synthsLength = synths.length;
        bool isSynths = synthsLength != 0;
        uint256 numTokens = isSynths ? itemsLength + synthsLength + 2 : itemsLength + 1;

        tokens = new IERC20[](numTokens);
        amounts = new uint256[](numTokens);
        for (uint256 i; i < itemsLength; ++i) {
           // Should not be possible to have address(0) since the Strategy will check for it
           IERC20 token = IERC20(items[i]);
           amounts[i] = _getBalanceShare(token, percentage);
           tokens[i] = token;
        }
        if (isSynths) {
            for (uint256 i = itemsLength; i < numTokens - 2; ++i) {
                IERC20 synth = IERC20(synths[i - itemsLength]);
                amounts[i] = _getBalanceShare(synth, percentage);
                tokens[i] = synth;
            }
            // Include SUSD
            amounts[numTokens - 2] = _getBalanceShare(susd, percentage);
            tokens[numTokens - 2] = susd;
        }
        // Include WETH
        amounts[numTokens - 1] = _getBalanceShare(weth, percentage);
        tokens[numTokens - 1] = weth;
    }

    function getAllToClaim(ITokenRegistry tokenRegistry) public view returns(uint256[] memory keys, bytes[] memory values) {
        BinaryTreeWithPayload.Tree memory mm = BinaryTreeWithPayload.newNode();
        BinaryTree.Tree memory exists = BinaryTree.newNode();
        IStrategy _this = IStrategy(address(this));
        uint256 numAdded = _toClaim(mm, exists, tokenRegistry, _this.items());
        numAdded += _toClaim(mm, exists, tokenRegistry, _this.synths());
        numAdded += _toClaim(mm, exists, tokenRegistry, _this.debt());
        if (numAdded == 0) return (keys, values);
        keys = new uint256[](numAdded);
        values = new bytes[](numAdded);
        BinaryTreeWithPayload.readInto(mm, keys, values);
    }

    function _toClaim(
      BinaryTreeWithPayload.Tree memory mm,
      BinaryTree.Tree memory exists,
      ITokenRegistry tokenRegistry,
      address[] memory positions
    ) private view returns(uint256) {
        uint256 numAdded;
        address position;
        StrategyTypes.TradeData memory tradeData;
        uint256 adaptersLength;
        address rewardsAdapter;
        bytes32 key;
        bool ok;
        for (uint256 i; i < positions.length; ++i) {
            position = positions[i];
            if (!tokenRegistry.isClaimable(position)) continue;
            tradeData = IStrategy(address(this)).getTradeData(position);
            adaptersLength = tradeData.adapters.length;
            if (adaptersLength < 1) continue;
            rewardsAdapter = tradeData.adapters[adaptersLength - 1];
            key = keccak256(abi.encodePacked(rewardsAdapter, position));
            ok = exists.doesExist(key);
            if (ok) continue;
            exists.add(key);
            ok = mm.append(bytes32(uint256(rewardsAdapter)), bytes32(uint256(position)));
            // ok means "isNew"
            if (ok) ++numAdded;
        }
        return numAdded;
    }

    /**
     * @notice Claim rewards using a delegate call to an adapter
     * @param adapter The address of the adapter that this function does a delegate call to.
                      It must support the IRewardsAdapter interface and be whitelisted
     * @param tokens The addresses of the tokens being claimed
     */
    function _delegateClaim(address adapter, address[] memory tokens) private {
        // Since the adapters are part of the tradeData which could be updated by the manager, for security we check that the adapter is approved.
        require(IWhitelist(IStrategyProxyFactory(IStrategy(address(this)).factory()).whitelist()).approved(adapter), "adapter not approved.");
        bytes memory data =
            abi.encodeWithSelector(
                IRewardsAdapter.claim.selector,
                tokens
            );
        uint256 txGas = gasleft();
        bool success;
        assembly {
            success := delegatecall(txGas, adapter, add(data, 0x20), mload(data), 0, 0)
        }
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
        emit RewardsClaimed(adapter, tokens);
    }

    function _getBalanceShare(IERC20 token, uint256 percentage) private view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        return SafeMath.mul(balance, percentage) / PRECISION;
    }
}
