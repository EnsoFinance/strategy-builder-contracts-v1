//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

// as of v2.8.1
interface IComptroller {

    struct CompMarketState {
        /// @notice The market's last updated compBorrowIndex or compSupplyIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    function claimComp(address holder, address[] memory cTokens) external;

    function compBorrowState(address cToken) external view returns(CompMarketState memory);

    function compBorrowerIndex(address cToken, address borrower) external view returns(uint256);

    function compSupplyState(address cTokens) external view returns(CompMarketState memory);

    function compSupplyIndex(address cToken, address supplier) external view returns(uint256);
    
    function compAccrued(address account) external view returns(uint256);
}
