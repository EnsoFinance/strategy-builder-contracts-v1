//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IProtocolOracle.sol";

abstract contract ProtocolOracle is IProtocolOracle {
    using SafeMath for uint256;

    function weth() external view virtual override returns (address);

    function estimateTotal(address account, address[] memory tokens)
        public
        view
        override
        returns (uint256, uint256[] memory)
    {
        //Loop through tokens and calculate the total
        uint256 total = 0;
        uint256[] memory estimates = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 estimate;
            if (tokens[i] == address(0)) {
                estimate = account.balance;
            } else {
                estimate = consult(IERC20(tokens[i]).balanceOf(account), tokens[i]);
            }
            total = total.add(estimate);
            estimates[i] = estimate;
        }
        return (total, estimates);
    }

    function consult(uint256 amount, address input) public view virtual override returns (uint256);
}
