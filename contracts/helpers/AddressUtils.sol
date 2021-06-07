pragma solidity 0.6.12;

contract AddressUtils {
    string public constant ZERO_ADDRESS = "Zero address provided";
    modifier noZeroAddress(address addr) {
        require(addr != address(0), ZERO_ADDRESS);
        _;
    }
}