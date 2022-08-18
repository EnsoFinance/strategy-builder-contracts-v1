//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/registries/ITokenRegistry.sol";
import "../../helpers/StrategyTypes.sol";

contract TokenRegistry is ITokenRegistry, Ownable {
    mapping(address => uint256) public override itemCategories;
    mapping(address => uint256) public override estimatorCategories;
    mapping(uint256 => IEstimator) public override estimators;
    mapping(address => ItemDetails) private _itemDetails;

    function getEstimator(address token) external view override returns (IEstimator) {
        return estimators[estimatorCategories[token]];
    }

    function itemDetails(address item) external view override returns(ItemDetails memory) {
        return _itemDetails[item];
    }

    function isClaimable(address item) external view override returns(bool) {
        return _itemDetails[item].rewardsAdapter != address(0);
    }

    function addEstimator(uint256 estimatorCategoryIndex, address estimator) external override onlyOwner {
        estimators[estimatorCategoryIndex] = IEstimator(estimator);
        emit EstimatorAdded(estimator, estimatorCategoryIndex);
    }

    function addItem(
        uint256 itemCategoryIndex,
        uint256 estimatorCategoryIndex,
        address token
    ) external override onlyOwner {
        _addItem(itemCategoryIndex, estimatorCategoryIndex, token);
    }

    function addItemDetailed(
        uint256 itemCategoryIndex,
        uint256 estimatorCategoryIndex,
        address token,
        StrategyTypes.TradeData memory tradeData,
        address rewardsAdapter
    ) external override onlyOwner {
        _addItemDetailed(itemCategoryIndex, estimatorCategoryIndex, token, tradeData, rewardsAdapter);
    }

    function addItems(
        uint256[] calldata itemCategoryIndexes,
        uint256[] calldata estimatorCategoryIndexes,
        address[] calldata tokens
    ) external override onlyOwner {
        uint numItems = itemCategoryIndexes.length;
        require(estimatorCategoryIndexes.length == numItems && tokens.length == numItems, "Mismatched array lengths");
        for (uint i; i < numItems; ++i) {
            _addItem(itemCategoryIndexes[i], estimatorCategoryIndexes[i], tokens[i]);
        }
    }

    function addItemsDetailed(
        uint256[] calldata itemCategoryIndexes,
        uint256[] calldata estimatorCategoryIndexes,
        address[] calldata tokens,
        StrategyTypes.TradeData[] memory tradesData,
        address[] calldata rewardsAdapters
    ) external override onlyOwner {
        uint numItems = itemCategoryIndexes.length;
        require(
            estimatorCategoryIndexes.length == numItems &&
            tokens.length == numItems &&
            tradesData.length == numItems &&
            rewardsAdapters.length == numItems,
            "Mismatched array lengths"
        );
        for (uint i; i < numItems; ++i) {
            _addItemDetailed(
                itemCategoryIndexes[i],
                estimatorCategoryIndexes[i],
                tokens[i],
                tradesData[i],
                rewardsAdapters[i]
            );
        }
    }

    function _addItem(uint256 itemCategoryIndex, uint256 estimatorCategoryIndex, address token) internal {
        require(address(estimators[estimatorCategoryIndex]) != address(0), "Invalid category");
        itemCategories[token] = itemCategoryIndex;
        estimatorCategories[token] = estimatorCategoryIndex;
        emit ItemAdded(token, itemCategoryIndex, estimatorCategoryIndex);
    }

    function _addItemDetailed(
        uint256 itemCategoryIndex,
        uint256 estimatorCategoryIndex,
        address token,
        StrategyTypes.TradeData memory tradeData,
        address rewardsAdapter
    ) internal {
        ItemDetails storage id = _itemDetails[token];
        id.tradeData = tradeData;
        id.rewardsAdapter = rewardsAdapter;
        _addItem(itemCategoryIndex, estimatorCategoryIndex, token);
    }
}
