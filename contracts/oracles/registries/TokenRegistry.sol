//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/registries/ITokenRegistry.sol";

contract TokenRegistry is ITokenRegistry, Ownable {
    mapping(address => uint256) public override itemCategories;
    mapping(address => uint256) public override estimatorCategories;
    mapping(uint256 => IEstimator) public override estimators;
    mapping(address => bool) public override claimable;

    event EstimatorAdded(address estimator, uint256 estimatorCategoryIndex);
    event ItemAdded(address token, uint256 itemCategoryIndex, uint256 estimatorCategoryIndex, bool isClaimable);

    function getEstimator(address token) external view override returns (IEstimator) {
        return estimators[estimatorCategories[token]];
    }

    function addEstimator(uint256 estimatorCategoryIndex, address estimator) external override onlyOwner {
        estimators[estimatorCategoryIndex] = IEstimator(estimator);
        emit EstimatorAdded(estimator, estimatorCategoryIndex);
    }

    function addItem(uint256 itemCategoryIndex, uint256 estimatorCategoryIndex, address token, bool isClaimable) external override onlyOwner {
        _addItem(itemCategoryIndex, estimatorCategoryIndex, token, isClaimable);    
    }

    function addItems(uint256[] calldata itemCategoryIndex, uint256[] calldata estimatorCategoryIndex, address[] calldata token, bool[] calldata isClaimable) external override onlyOwner {
        uint numItems = itemCategoryIndex.length; 
        require(estimatorCategoryIndex.length == numItems && numItems == token.length && numItems == isClaimable.length, "Mismatched array lengths");
        for (uint i = 0; i < numItems; i++) {
           _addItem(itemCategoryIndex[i], estimatorCategoryIndex[i], token[i], isClaimable[i]); 
        }
    }

    function _addItem(uint256 itemCategoryIndex, uint256 estimatorCategoryIndex, address token, bool isClaimable) internal {
        require(address(estimators[estimatorCategoryIndex]) != address(0), "Invalid category");
        itemCategories[token] = itemCategoryIndex;
        estimatorCategories[token] = estimatorCategoryIndex;
        claimable[token] = isClaimable;
        emit ItemAdded(token, itemCategoryIndex, estimatorCategoryIndex, isClaimable);
    }
}
