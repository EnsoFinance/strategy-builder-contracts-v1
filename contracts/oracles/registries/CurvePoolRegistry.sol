//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/curve/ICurveStableSwap.sol";
import "../../interfaces/curve/ICurvePoolRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CurvePoolRegistry is ICurvePoolRegistry, Ownable {

    mapping(address => address) public override depositContracts;
    mapping(address => address) public override swapContracts;
    mapping(address => address) public override gaugeContracts;
    mapping(address => uint256) public override coinsInPool;
    mapping(address => mapping(address => uint256)) public override coinIndexes;
    mapping(address => mapping(uint256 => address)) public override coins;
    mapping(address => mapping(address => address)) public override exchanges;

    function addPool(address token, address deposit, address swap, address gauge, bool isInt128) external onlyOwner {
        depositContracts[token] = deposit; // token -> deposit
        swapContracts[token] = swap;
        gaugeContracts[token] = gauge;

        ICurveStableSwap swapContract = ICurveStableSwap(swap);
        uint256 index = 0;
        bool complete = false;
        if (isInt128) {
            while (!complete) {
                try swapContract.coins(int128(index)) returns (address coin) {
                  coins[token][index] = coin;
                  coinIndexes[token][coin] = index;
                  index++;
                } catch {
                  coinsInPool[token] = index;
                  complete = true;
                }
            }
            require(coinsInPool[token] > 0, "No coins");
            for (int128 i = 0; i < int128(coinsInPool[token]); i++) {
                address iCoin = swapContract.coins(i);
                for (int128 j = 0; j < int128(coinsInPool[token]); j++) {
                    address jCoin = swapContract.coins(j);
                    if (iCoin != jCoin) {
                      exchanges[iCoin][jCoin] = token;
                    }
                }
            }
        } else {
            while (!complete) {
                try swapContract.coins(index) returns (address coin) {
                  coins[token][index] = coin;
                  coinIndexes[token][coin] = index;
                  index++;
                } catch {
                  coinsInPool[token] = index;
                  complete = true;
                }
            }
            require(coinsInPool[token] > 0, "No coins");
            for (uint256 i = 0; i < coinsInPool[token]; i++) {
                address iCoin = swapContract.coins(i);
                for (uint256 j = 0; j < coinsInPool[token]; j++) {
                    address jCoin = swapContract.coins(j);
                    if (iCoin != jCoin) {
                      exchanges[iCoin][jCoin] = token;
                    }
                }
            }
        }
    }
}
