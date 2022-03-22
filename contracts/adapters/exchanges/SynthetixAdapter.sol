//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/synthetix/ISynth.sol";
import "../../interfaces/synthetix/ISynthetix.sol";
import "../../interfaces/synthetix/IExchanger.sol";
import "../../interfaces/synthetix/IAddressResolver.sol";
import "../../interfaces/synthetix/IDelegateApprovals.sol";
import "../BaseAdapter.sol";

contract SynthetixAdapter is BaseAdapter {
    //using SafeERC20 for IERC20;

    IAddressResolver public immutable resolver;

    constructor(
        address resolver_,
        address weth_
    ) public BaseAdapter(weth_) {
        resolver = IAddressResolver(resolver_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external override returns (uint256) {
        ISynthetix synthetix = _resolveSynthetix();
        (bytes32 nameIn, bytes32 nameOut) = _resolveTokens(synthetix, tokenIn, tokenOut);
        IExchanger exchanger = IExchanger(resolver.getAddress("Exchanger"));
        (uint256 received, uint256 fee, ) =
            exchanger.getAmountsForExchange(amount, nameIn, nameOut);
        return received + fee;
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        require(from == to, "Synth exchanges must return to same address");

        ISynthetix synthetix = _resolveSynthetix();
        (bytes32 nameIn, bytes32 nameOut) = _resolveTokens(synthetix, tokenIn, tokenOut);
        uint256 received;
        if (from != address(this)) {
            received = synthetix.exchangeOnBehalf(from, nameIn, amount, nameOut);
        } else {
            received = synthetix.exchange(nameIn, amount, nameOut);
        }
        require(received >= expected, "Insufficient tokenOut amount");
    }

    function _resolveTokens(
        ISynthetix synthetix,
        address tokenIn,
        address tokenOut
    ) internal view returns (bytes32, bytes32) {
        bytes32 nameIn = synthetix.synthsByAddress(ISynth(tokenIn).target());
        bytes32 nameOut = synthetix.synthsByAddress(ISynth(tokenOut).target());
        require(nameIn != bytes32(0) && nameOut != bytes32(0), "No synths");

        return (nameIn, nameOut);
    }

    function _resolveSynthetix() internal view returns (ISynthetix) {
        address synthetix = resolver.getAddress("Synthetix");
        require(synthetix != address(0), "Missing from Synthetix resolver");
        return ISynthetix(synthetix);
    }
}
