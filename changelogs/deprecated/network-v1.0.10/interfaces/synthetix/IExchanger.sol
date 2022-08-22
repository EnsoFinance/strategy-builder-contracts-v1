//SPDX-License-Identifier: Unlicensed
pragma solidity >=0.4.24;

// https://docs.synthetix.io/contracts/source/interfaces/iexchanger
interface IExchanger {

    function maxSecsLeftInWaitingPeriod(address account, bytes32 currencyKey) external view returns (uint);

    function getAmountsForExchange(
        uint sourceAmount,
        bytes32 sourceCurrencyKey,
        bytes32 destinationCurrencyKey
    )
        external
        view
        returns (
            uint amountReceived,
            uint fee,
            uint exchangeFeeRate
        );

    function waitingPeriodSecs() external view returns (uint);

    function settle(address from, bytes32 currencyKey)
        external
        returns (
            uint reclaimed,
            uint refunded,
            uint numEntries
        );
}
