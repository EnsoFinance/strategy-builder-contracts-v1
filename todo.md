/*
    1. Create portfolio in portfoliofactory
    2. Approves portfolio contract
    3. deposits
        // allowance
    We need to get tokens from user A into portfolio contract
*/

        /*
            new portfolio(msg.sender)
        */

// contract PropotionalPortfolio is Portfolio {

//     struct Item {
//         address tokens;
//         uint split;
//     }

//     function intialize(
//         address [] memory tokens,
//         uint [] memory split
//     ) payable {
//         //ETH.
//         //WETH.transferFrom
//     }

//     function restructure(address [] memory tokens, uint [] memory split) public
//     {

//     }

//     /*
//         1. individual portfolio
//         2. social portfolio
//         3. rebalancing
//         4. duplication
//     */

//     /*
//     *   rudamentary
//     *   50/50 WETH/DAI
//     *   80/20 WETH/DAI
//     *
//     *   other assets
//     *   80/10/10 WETH/DAI/BAT
//     */

//     function rebalance() external {

//     }

//     function _purchaseStructure() internal {

//     }

//     function _currentStructure() internal {

//     }

//     function deposit(
//         address [] memory tokens,
//     ) {
//         // mint relative ownership token - similar to LP token
//     }

//     function withdrawTokens(uint amount) public
//     {
//         // burns LP relative token for underlying allocation
//     }

//     function updateFee(uint fee) public {

//     }
// }


/*
TODO:
* Introduce Proxy
* createPortfolio
    bool socialTrading, uint fee
* Portfolio:
    * Use EnumerableSet
      https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/EnumerableSet.sol
* Design
    * Creating portfolio - add asset/dummy button with WETH
    * Add dialog - name portfolin, two steps: deploy and confirm
    * Dialog for transtion mining (overlay)
    * Remove remove button
*/
