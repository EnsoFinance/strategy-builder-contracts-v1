## Changelog after code4ena engagement

### Must redeploy

```
contracts/Strategy.sol                             | 735 ++++++------------
contracts/StrategyController.sol                   | 520 ++++---------
contracts/StrategyProxyFactory.sol                 | 142 +++-
contracts/adapters/borrow/AaveV2DebtAdapter.sol    |  37 +-
contracts/adapters/borrow/Leverage2XAdapter.sol    |  11 +-
contracts/adapters/exchanges/CurveAdapter.sol      |   7 +-
contracts/adapters/exchanges/UniswapV3Adapter.sol  |   7 +-
contracts/adapters/lending/AaveV2Adapter.sol       |  63 +-
contracts/adapters/lending/CompoundAdapter.sol     |  62 +-
contracts/adapters/liquidity/CurveLPAdapter.sol    |   8 +-
contracts/adapters/vaults/CurveGaugeAdapter.sol    |  65 +-
contracts/adapters/vaults/YEarnV2Adapter.sol       |  51 +-
.../recovery/StrategyControllerPaused.sol          |  16 +
contracts/libraries/ControllerLibrary.sol          | 520 +++++++++++++
contracts/libraries/StrategyClaim.sol              | 177 +++++
contracts/libraries/StrategyLibrary.sol            |  90 +--
contracts/oracles/EnsoOracle.sol                   |   4 +
.../oracles/estimators/CurveGaugeEstimator.sol     |  14 +-
contracts/oracles/estimators/CurveLPEstimator.sol  |  47 +-
.../oracles/estimators/EmergencyEstimator.sol      |  41 +-
contracts/oracles/protocols/ChainlinkOracle.sol    |   5 +-
contracts/oracles/registries/TokenRegistry.sol     |  24 +-
contracts/routers/FullRouter.sol                   | 510 +++++++-----
contracts/routers/LoopRouter.sol                   |  83 +-
contracts/routers/MulticallRouter.sol              |  15 +-
contracts/routers/StrategyRouter.sol               |  18 +-
```


-------------------------------------------------------------------------------

### Interface updates for Frontend

```

Strategy

+    function updateTimelock(bytes4 functionSelector, uint256 delay) external;
+    function finalizeTimelock() external;

+    function updateTradeData(address item, TradeData memory data) external;
+    function finalizeUpdateTradeData() external {

+    function getAllRewardTokens() external view returns(address[] memory rewardTokens)
+    function claimAll() external;
+    function factory() external view returns (address);
-    function performanceFee() external view returns (uint256);
-    function getPerformanceFeeOwed(address account) external view returns (uint256);
-    function controller() external view returns (address);
-    function oracle() external view returns (IOracle);
-    function whitelist() external view returns (IWhitelist);
-    function supportsSynths() external view returns (bool);

StrategyController
+    function claimAll(
+        IStrategy strategy
+    ) external;

+    function weth() external view returns (address);
+    function pool() external view returns (address);

StrategyProxyFactory
     function createStrategy(
-        address manager,
         string memory name,
         string memory symbol,
         StrategyItem[] memory strategyItems,
-        InitialState memory strategyInit,
+        InitialState memory strategyState,
         address router,
         bytes memory data
     ) external payable returns (address);
+    function createStrategyFor(
+        address manager,
+        string memory name,
+        string memory symbol,
+        StrategyItem[] memory strategyItems,
+        InitialState memory strategyState,
+        address router,
+        bytes memory data,
+        bytes memory signature
+    ) external payable returns (address);

TokenRegistry
+    struct ItemDetails {
+        bool isClaimable;
+        StrategyTypes.TradeData tradeData;
+    }
+    function itemDetails(address item) external view returns(ItemDetails memory);
+    function isClaimable(address item) external view returns(bool);
+    function addItemDetailed(uint256 itemCategoryIndex, uint256 estimatorCategoryIndex, address token, StrategyTypes.TradeData memory tradeData, bool isClaimable) external;

EmergencyEstimator
+    function updateTimelock(bytes4 functionSelector, uint256 delay) external;
+    function finalizeTimelock() external;
+    function estimateItem(uint256 balance, address token) public view returns (int256);
+    function updateEstimate(address token, int256 amount) external;
+    function finalizeSetEstimate() external;
```

-------------------------------------------------------------------------------

commit dd7dd46a29cc39041213943e92f0df286485bd36 (HEAD -> develop, origin/develop, origin/HEAD)
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jul 26 10:17:52 2022 -0700

feat: binarytree updates [#223](https://github.com/EnsoFinance/v1-core/pull/223)

commit 2e604212a03dada5f4e1c475f1a354606eca2f91
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Fri Jul 22 09:35:19 2022 -0700

Debt exploit fix [#222](https://github.com/EnsoFinance/v1-core/pull/222)

Co-authored-by: George Carder <georgercarder@gmail.com>

commit d10cdfced01b6e3620f80048c2ced4ef57a1a372
Author: George Carder <georgercarder@gmail.com>
Date:   Thu Jul 21 15:30:06 2022 -0700

Claim and account for stkAAVE [#193](https://github.com/EnsoFinance/v1-core/pull/193)

commit 50ad8f3b23d30ffedeee9a3ffede4d770d5a6676
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Wed Jul 20 15:46:45 2022 -0700

Restrict repositionSynths to only use synthetixAdapter [#218](https://github.com/EnsoFinance/v1-core/pull/218)

commit ae64310efef115bbc710861729b62d40109f37f6
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Wed Jul 20 15:41:03 2022 -0700

Fix timelock [#217](https://github.com/EnsoFinance/v1-core/pull/217)

commit 0747b2bd09f2e9f2f2dfb85c09f09a5a27c53340
Author: George Carder <georgercarder@gmail.com>
Date:   Wed Jul 20 15:27:44 2022 -0700

Improve accuracy of curve lp estimator [#192](https://github.com/EnsoFinance/v1-core/pull/192)

Co-authored-by: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>

commit 360b96344665c90444a6148c456d0bd5a7724071
Author: George Carder <georgercarder@gmail.com>
Date:   Wed Jul 20 13:05:47 2022 -0700

Update rewards on set strategy [#206](https://github.com/EnsoFinance/v1-core/pull/206)

Co-authored-by: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>

commit d3ef9abd0681faee71af16d51bf73f1c121681b8
Author: George Carder <georgercarder@gmail.com>
Date:   Wed Jul 20 11:49:54 2022 -0700

bugfix: address restructuring of debt positions' deficiencies [#200](https://github.com/EnsoFinance/v1-core/pull/200)

Co-authored-by: PeterMPhillips <github@pmphillips.ca>

commit 25ce5388699ca673cc39c73c22ddfb89b3a21eb4
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jul 19 09:56:31 2022 -0700

claimAll and account for rewards tokens [#190](https://github.com/EnsoFinance/v1-core/pull/190)

Co-authored-by: PeterMPhillips <github@pmphillips.ca>

commit 1108accf9f72c7a7c65dba2c5af08544caf1161f
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jul 19 09:45:20 2022 -0700

controller split [#208](https://github.com/EnsoFinance/v1-core/pull/208)

commit fe6f50715777bed646a3ab9f2a7bc45356accbb6
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jul 19 09:45:02 2022 -0700

concurrent test and prettier tool [#209](https://github.com/EnsoFinance/v1-core/pull/209)

commit 63a39b381481bfdae71bb18c455990144052f7fc
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jul 19 08:27:24 2022 -0700

use prettier on tests [#207](https://github.com/EnsoFinance/v1-core/pull/207)

commit afb973d180fdc15cd8dd4074b07b48e1b77e3e80
Author: Kyle Dewhurst <15720036+kyledewy@users.noreply.github.com>
Date:   Thu Jul 14 09:52:48 2022 -0700

Add check in adapters for fee-on-transfer-tokens [#178](https://github.com/EnsoFinance/v1-core/pull/178)

commit 1d522a298bb8ff30aeaa647b5dbfad991658f8ba
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Tue Jul 5 09:22:45 2022 -0700

Update fees mechanism for simplicity [#194](https://github.com/EnsoFinance/v1-core/pull/194)

Co-authored-by: George Carder <georgercarder@gmail.com>

commit 6043316088934e536e9cc0cf5d0b76a902558949
Author: George Carder <georgercarder@gmail.com>
Date:   Fri Jul 1 10:37:08 2022 -0700

check compound error codes [#170](https://github.com/EnsoFinance/v1-core/pull/170)

commit b04f174a6ee54fe47043ca3bfc756e48d3108444
Author: George Carder <georgercarder@gmail.com>
Date:   Thu Jun 30 09:45:13 2022 -0700

bugfix: encode.prepareStrategy throw on repeated position [#198](https://github.com/EnsoFinance/v1-core/pull/198)

commit d6572df17f5ad49050a841e4997c068fc8e7d457
Author: George Carder <georgercarder@gmail.com>
Date:   Fri Jun 24 13:49:21 2022 -0700

bugfix: parseInt leftover from prior implementation. throws unnecessarily in some cases. [#195](https://github.com/EnsoFinance/v1-core/pull/195)

commit 5bd5a67c1e9094dc1fad824e4311316d74bd3be7
Author: Kyle Dewhurst <15720036+kyledewy@users.noreply.github.com>
Date:   Thu Jun 16 15:02:01 2022 -0700

check amountOut after swap [#180](https://github.com/EnsoFinance/v1-core/pull/180)

commit 2e79adf7b2714cae0eacb90936a930148e0b9cee
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Thu Jun 16 15:01:49 2022 -0700

Multicall warning [#182](https://github.com/EnsoFinance/v1-core/pull/182)

commit 7ed42c99f2e0371c13fbdbfd9f62f1230d305a7f
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Thu Jun 16 07:49:26 2022 -0700

Restrict deposits while restructuring [#160](https://github.com/EnsoFinance/v1-core/pull/160)

commit b36a3fbc6e969f3778abd5f4962544461bf20629
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jun 14 08:18:04 2022 -0700

createStrategyFor to guard against proxy squatting [#177](https://github.com/EnsoFinance/v1-core/pull/177)

commit a35e02c371bd86f84f770f7e72498049e794b8f9
Author: George Carder <georgercarder@gmail.com>
Date:   Mon Jun 13 12:32:52 2022 -0700

onlyApproved router [#158](https://github.com/EnsoFinance/v1-core/pull/158)

commit 5e5a825053afc8a2ba008d11306af70293e80c4e
Author: George Carder <georgercarder@gmail.com>
Date:   Mon Jun 13 12:22:00 2022 -0700

synthetix-adapter test respects compoundAdapter [#185](https://github.com/EnsoFinance/v1-core/pull/185)

commit d69da1daeee3ffdb9281892f908d6e7befba5ecf
Author: George Carder <georgercarder@gmail.com>
Date:   Mon Jun 13 12:15:07 2022 -0700

use memory mapping for fullRouter [#184](https://github.com/EnsoFinance/v1-core/pull/184)

commit 5983db82067d8b82194bcc33e15f6e5bc0b097f5
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Mon Jun 13 09:57:15 2022 -0700

include expected amount in settleSwap [#179](https://github.com/EnsoFinance/v1-core/pull/179)

commit 031934757802ad0530d659650c4a5cb63dfc86bc
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Mon Jun 13 09:33:18 2022 -0700

Adapter whitelist for self-checking tokens [#167](https://github.com/EnsoFinance/v1-core/pull/167)

commit 58b8c6f489cc7c1f75ceea94e93b0e5e6008b9cb
Author: George Carder <georgercarder@gmail.com>
Date:   Fri Jun 10 08:25:08 2022 -0700

packing storage saves gas. [#181](https://github.com/EnsoFinance/v1-core/pull/181)

commit 6d041492c4a181b3973935a604df68a5194533ab
Author: George Carder <georgercarder@gmail.com>
Date:   Thu Jun 9 09:39:11 2022 -0700

ensure oracles are in step between strategy and controller [#176](https://github.com/EnsoFinance/v1-core/pull/176)

commit 170fa560913b912be149e62a9183decd18b7529e
Author: Kyle Dewhurst <15720036+kyledewy@users.noreply.github.com>
Date:   Thu Jun 9 09:37:11 2022 -0700

Call updateTokenValue() on strategy during controller._withdraw() [#173](https://github.com/EnsoFinance/v1-core/pull/173)

commit ac6e90d584ad92ecb9c8597e905c2fe2ba69a7a2
Author: George Carder <georgercarder@gmail.com>
Date:   Wed Jun 8 15:58:29 2022 -0700

event and timelock on updateTradeData [#166](https://github.com/EnsoFinance/v1-core/pull/166)

commit 2df3cb0561fad29fc17a9a81dfaa9db8292d3e3c
Author: George Carder <georgercarder@gmail.com>
Date:   Wed Jun 8 15:56:53 2022 -0700

event and timelock on updateEstimate [#165](https://github.com/EnsoFinance/v1-core/pull/165)

commit 9aa5f5cdef9a9d20afdc2fe4662e3682557e3d86
Author: George Carder <georgercarder@gmail.com>
Date:   Wed Jun 8 14:08:27 2022 -0700

feature: timelocks [#164](https://github.com/EnsoFinance/v1-core/pull/164)

commit ec710c9746146fe4b5f1a4aa75ee299bf887e55d
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jun 7 15:57:30 2022 -0700

guard against stale price [#157](https://github.com/EnsoFinance/v1-core/pull/157)

commit c5131e7d8bc68161236d3564328b2cc811f48a7c
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jun 7 15:22:14 2022 -0700

bugfix: length check [#174](https://github.com/EnsoFinance/v1-core/pull/174)

commit 2fe38ecbcb8cf8ab66e73146a8ce0dc7897901b0
Author: George Carder <georgercarder@gmail.com>
Date:   Tue Jun 7 15:20:31 2022 -0700

check target for low-level calls of multicall are contracts [#175](https://github.com/EnsoFinance/v1-core/pull/175)

commit ed39c558b0ba46c574de764f8c699d1ab35d0115
Author: Kyle Dewhurst <15720036+kyledewy@users.noreply.github.com>
Date:   Tue Jun 7 19:56:41 2022 +0200

feat: add 30 day max_timelock check in strategy controller [#172](https://github.com/EnsoFinance/v1-core/pull/172)

commit 87d4ba8002e0d4ad688a9693dcb93819c8a1730e
Author: George Carder <georgercarder@gmail.com>
Date:   Mon Jun 6 15:18:59 2022 -0700

feat: error macro system [#163](https://github.com/EnsoFinance/v1-core/pull/163)

commit 69d388ec660013601467787d3d1fb630e58420c1
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Mon Jun 6 14:21:53 2022 -0700

fix router withdraw [#94](https://github.com/EnsoFinance/v1-core/pull/94)

Co-authored-by: George Carder <georgercarder@gmail.com>

commit e6de9016dc67e8f033e2f89049f53c974adf7d5b
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Mon Jun 6 14:00:52 2022 -0700

Block deposit that don't mint tokens [#162](https://github.com/EnsoFinance/v1-core/pull/162)

commit c8905197045e53b9f311b31d13be870bbee56211
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Mon Jun 6 13:58:14 2022 -0700

Increase yearn max loss [#161](https://github.com/EnsoFinance/v1-core/pull/161)
