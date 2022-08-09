//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "./IERC20NonStandard.sol";

interface IStrategyToken is IERC20NonStandard {
    event FlashFeeUpdated(address account, uint256 fee);

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function setFlashFee(uint256 fee) external;

    function flashTransfer(address from, address to, uint256 amount, bytes memory data) external;

    function nonces(address owner) external view returns (uint256);

    function version() external view returns (string memory);
}
