//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPortfolio is IERC20 {
    function approveToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external;

    function approveTokens(address account, uint256 amount) external;

    function transferToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external;

    function setStructure(address[] memory newTokens, uint256[] memory newPercentages) external;

    function withdraw(uint256 amount) external;

    function updateManager(address newManager) external;

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function mint(address account, uint256 amount) external;

    function burn(address account, uint256 amount) external;

    function tokens() external view returns (address[] memory);

    function tokenPercentage(address token) external view returns (uint256);

    function nonces(address owner) external view returns (uint256);

    function isWhitelisted(address account) external view returns (bool);

    function controller() external view returns (address);

    function manager() external view returns (address);

    function oracle() external view returns (address);

    function whitelist() external view returns (address);
}
