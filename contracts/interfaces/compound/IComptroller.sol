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

    struct Market {
        /// @notice Whether or not this market is listed
        bool isListed;

        /**
         * @notice Multiplier representing the most one can borrow against their collateral in this market.
         *  For instance, 0.9 to allow borrowing 90% of collateral value.
         *  Must be between 0 and 1, and stored as a mantissa.
         */
        uint collateralFactorMantissa;

        /// @notice Per-market mapping of "accounts in this asset"
        //mapping(address => bool) accountMembership;

        /// @notice Whether or not this market receives COMP
        bool isComped;
    }

    function claimComp(address holder, address[] memory cTokens) external;

    function compBorrowState(address cToken) external view returns(CompMarketState memory);

    function compBorrowerIndex(address cToken, address borrower) external view returns(uint256);
    function compSupplyState(address cTokens) external view returns(CompMarketState memory);

    function compSupplierIndex(address cToken, address supplier) external view returns(uint256);
    function compAccrued(address account) external view returns(uint256);

    function getCompAddress() external view returns(address);

    function markets(address cToken) external view returns(Market memory);
}
