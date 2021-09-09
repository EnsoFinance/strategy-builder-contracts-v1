// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.6.0 <0.9.0;

interface ILendingPool {
    function deposit(
      address asset,
      uint256 amount,
      address onBehalfOf,
      uint16 referralCode
    ) external;

    function withdraw(
      address asset,
      uint256 amount,
      address to
    ) external returns (uint256);

    function borrow(
      address asset,
      uint256 amount,
      uint256 interestRateMode,
      uint16 referralCode,
      address onBehalfOf
    ) external;

    function repay(
      address asset,
      uint256 amount,
      uint256 rateMode,
      address onBehalfOf
    ) external returns (uint256);

    function setUserUseReserveAsCollateral(
      address asset,
      bool useAsCollateral
    ) external;
}
