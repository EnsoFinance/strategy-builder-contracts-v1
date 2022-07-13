//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./interfaces/IStrategyToken.sol";
import "./helpers/StrategyTypes.sol";

contract StrategyCommonStorage is StrategyTypes {
    
    string internal _name;
    string internal _symbol;
    string internal _version;

    uint8 internal _locked; 

    address internal _manager;
    address internal _pool;
    address internal _oracle;
    address internal _weth;
    address internal _susd; 

    // Gap for future storage changes
    uint256[50] private __gap;
}
