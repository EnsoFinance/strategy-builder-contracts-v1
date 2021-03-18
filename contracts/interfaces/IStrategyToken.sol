//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStrategyToken is IERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function nonces(address owner) external view returns (uint256);
}
