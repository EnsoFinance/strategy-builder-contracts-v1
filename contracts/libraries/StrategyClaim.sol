//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IStrategy.sol";
import "../interfaces/IRewardsAdapter.sol";
import "../helpers/StrategyTypes.sol";
import "./MemoryMappings.sol";

library StrategyClaim {
    using MemoryMappings for BinaryTreeWithPayload.Tree;

    event RewardsClaimed(address indexed adapter, address[] indexed tokens);

    function _claimAll() public {
        (uint256[] memory keys, bytes[] memory values) = _getAllToClaim();
        address[] memory tokens;
        for (uint256 i; i < values.length; ++i) {
            (tokens) = abi.decode(values[i], (address[]));
            _delegateClaim(address(uint256(keys[i])), tokens); 
        }
    }

    function _getAllRewardTokens() public view returns(address[] memory rewardTokens) {
        (uint256[] memory keys, bytes[] memory values) = _getAllToClaim();
        IRewardsAdapter rewardsAdapter;
        address[] memory claimableTokens;
        address[] memory _rewardTokens;
        address rewardToken;
        BinaryTreeWithPayload.Tree memory mm;
        uint256 tokensAdded;
        bytes memory dummyData = abi.encode(tokensAdded);
        for (uint256 i; i < values.length; ++i) {
            rewardsAdapter = IRewardsAdapter(address(keys[i]));
            (claimableTokens) = abi.decode(values[i], (address[]));
            for (uint256 j; j < claimableTokens.length; ++j) {
                _rewardTokens = rewardsAdapter.rewardsTokens(claimableTokens[i]); 
                for (uint256 k; k < _rewardTokens.length; ++k) {
                    if (BinaryTreeWithPayload.replace(mm, uint256(_rewardTokens[k]), dummyData)) ++tokensAdded;       
                }
            }
        }
        keys = new uint256[](tokensAdded+1); // +1 is for length entry. see `BinaryTreeWithPayload.readInto`
        values = new bytes[](tokensAdded);
        BinaryTreeWithPayload.readInto(mm, keys, values);
        (rewardTokens) = abi.decode(abi.encode(keys), (address[]));
    }

    function _getAllToClaim() private view returns(uint256[] memory keys, bytes[] memory values) {
        BinaryTreeWithPayload.Tree memory mm = BinaryTreeWithPayload.newNode();
        BinaryTreeWithPayload.Tree memory exists = BinaryTreeWithPayload.newNode();
        IStrategy _this = IStrategy(address(this));
        uint256 numAdded = _toClaim(mm, exists, _this.items());
        numAdded += _toClaim(mm, exists, _this.synths());
        numAdded += _toClaim(mm, exists, _this.debt());
        if (numAdded == 0) return (keys, values);
        keys = new uint256[](numAdded+1); // +1 is for length entry. see `BinaryTreeWithPayload.readInto`
        values = new bytes[](numAdded);
        BinaryTreeWithPayload.readInto(mm, keys, values);
    }

    function _toClaim(
      BinaryTreeWithPayload.Tree memory mm,
      BinaryTreeWithPayload.Tree memory exists,
      address[] memory positions
    ) private view returns(uint256) {
        uint256 numAdded;
        ITokenRegistry tokenRegistry = IStrategy(address(this)).oracle().tokenRegistry();
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
            (ok, ) = exists.getValue(key);
            if (ok) continue;
            exists.add(key, bytes32(0x0)); // second parameter is "any" value
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
        // unchecked: adapter is approved since this is from the tokenRegistry
        bytes memory data =
            abi.encodeWithSelector(
                bytes4(keccak256("claim(address[])")),
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
}
