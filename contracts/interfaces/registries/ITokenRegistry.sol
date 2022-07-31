//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "../IEstimator.sol";
import "../../helpers/StrategyTypes.sol";

interface ITokenRegistry {
    function itemCategories(address token) external view returns (uint256);

    function estimatorCategories(address token) external view returns (uint256);

    function estimators(uint256 categoryIndex) external view returns (IEstimator);

    struct ItemDetails {
        bool isClaimable;
        StrategyTypes.TradeData tradeData;
    }

    function itemDetails(address item) external view returns(ItemDetails memory);

    function isClaimable(address item) external view returns(bool);

    function getEstimator(address token) external view returns (IEstimator);

    function addEstimator(uint256 estimatorCategoryIndex, address estimator) external;

    function addItem(uint256 itemCategoryIndex, uint256 estimatorCategoryIndex, address token) external;

    function addItemDetailed(uint256 itemCategoryIndex, uint256 estimatorCategoryIndex, address token, StrategyTypes.TradeData memory tradeData, bool isClaimable_) external;

    function addItems(uint256[] calldata itemCategoryIndex, uint256[] calldata estimatorCategoryIndex, address[] calldata token) external;
}
