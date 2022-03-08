// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SignedSafeMath.sol";

// simplified calculus library based on github.com/georgercarder/CalculuSol

library SimpleCalculus {
  using SignedSafeMath for int256;

  struct fn { // fn will always mean "function" 
    int[] coefficients;
    uint one;
  }

  // polynomial
  function newFn(int[] memory coefficients, uint one) internal pure returns(fn memory) {
    return fn(coefficients, one);
  }

  struct Number {
    int value;
    uint one;
  } 
  
  // evaluates polynomial having rational input and coeffiecients 
  function evaluatePolynomial(fn memory self, int input) internal pure returns(Number memory) {
    return _evaluatePolynomial(self, input);
  }

  // assumes input, and coefficients are rationals Q
  function _evaluatePolynomial(fn memory self, int input) private pure returns(Number memory) { 
    uint coefLen = self.coefficients.length;
    int lastPower = int(self.one);
    int power;
    int ret = self.coefficients[0].mul(lastPower);
    for (uint i=1; i<coefLen; i++) {
      power = lastPower.mul(input).div(int(self.one));
      ret += self.coefficients[i].mul(power);
      lastPower = power;
    }
    ret = ret.div(int(self.one));
    return Number(ret, self.one);
  }

  function differentiatePolynomial(fn memory self) internal pure returns(fn memory) {
    return _differentiatePolynomial(self);
  }

  function _differentiatePolynomial(fn memory self) private pure returns(fn memory) {
    uint coefLen = self.coefficients.length;
    int[] memory coefficients = new int[](coefLen-1);
    for (uint i=0; i<coefLen-1; i++) {
      coefficients[i] = self.coefficients[i+1].mul(int(i+1));
    } 
    return newFn(coefficients, self.one);
  }

}
