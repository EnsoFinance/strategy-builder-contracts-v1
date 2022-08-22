## Changelog after code4ena engagement

### Must redeploy

```
```

-------------------------------------------------------------------------------

### Interface updates for Frontend

```
Strategy

StrategyController

StrategyProxyFactory

TokenRegistry

EmergencyEstimator
```

### Events

```
registries/IChainlinkRegistry.sol
event OracleAdded(address indexed token, address indexed pair, address indexed oracle, bool inverse);
event OracleRemoved(address indexed token);

registries/ITokenRegistry.sol
event EstimatorAdded(address estimator, uint256 estimatorCategoryIndex);
event ItemAdded(address token, uint256 itemCategoryIndex, uint256 estimatorCategoryIndex);

registries/IUniswapV3Registry.sol
event PoolAdded(address indexed token, address indexed pair, uint24 indexed fee, uint32 timeWindow);
event PoolRemoved(address indexed token);
event FeeAdded(address indexed token, address indexed pair, uint24 indexed fee);
event FeeRemoved(address indexed token, address indexed pair);
event TimeWindowUpdated(address indexed token, uint32 indexed timeWindow);

IStrategyProxyFactory.sol
event Update(address newImplementation, string version);
event NewStrategy(
event NewOracle(address newOracle);
event NewRegistry(address newRegistry);
event NewWhitelist(address newWhitelist);
event NewPool(address newPool);
event NewStreamingFee(uint256 newStreamingFee);
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

IStrategyController.sol
event NewStructure(address indexed strategy, StrategyItem[] items, bool indexed finalized);
event NewValue(address indexed strategy, TimelockCategory category, uint256 newValue, bool indexed finalized);
event UpdateTradeData(address indexed strategy, address indexed item, TradeData data, bool indexed finalized);
event StrategyOpen(address indexed strategy);
event StrategySet(address indexed strategy);
event RebalanceParametersUpdated(uint256 indexed rebalanceTimelockPeriod, uint256 indexed rebalanceThreshold, bool indexed finalized);
events are called in the `ControllerLibrary`
event Balanced(address indexed strategy, uint256 totalBefore, uint256 totalAfter);
event Deposit(address indexed strategy, address indexed account, uint256 value, uint256 amount);
event Withdraw(address indexed strategy, address indexed account, uint256 value, uint256 amount);
event Repositioned(address indexed strategy, address indexed adapter, address indexed token);

IStrategy.sol
event Withdraw(address indexed account, uint256 amount, uint256[] amounts);
event UpdateManager(address manager);
event ClaimablesUpdated();
event RewardsUpdated();
event RewardsClaimed(address indexed adapter, address[] indexed tokens);
event VersionUpdated(string indexed newVersion);
event StreamingFee(uint256 amount);
event ManagementFee(uint256 amount);


```

-------------------------------------------------------------------------------

commit d263155e0363354799508fc6557cc24aea965955
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Sat Aug 20 12:19:50 2022 -0700

Warnings fixes [#262](https://github.com/EnsoFinance/v1-core/pull/262)

commit c7f1215ba46bd44ae7451d4da973b518db5228ef
Author: George Carder <georgercarder@gmail.com>
Date:   Thu Aug 18 15:19:20 2022 -0700

upgrade scripts w/o test of deployments [#260](https://github.com/EnsoFinance/v1-core/pull/260)

Co-authored-by: Peter Phillips <github@pmphillips.ca>

commit bfc354b06ed655a3539215d9cbb8c3ebef0a7974
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Thu Aug 18 09:44:22 2022 -0700

Batch items detailed [#259](https://github.com/EnsoFinance/v1-core/pull/259)

commit 9dff4c94ebc4779238ea0fd1947a4529867ad186
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Thu Aug 18 08:37:59 2022 -0700

Refactor strategy timelock [#257](https://github.com/EnsoFinance/v1-core/pull/257)

commit d53610665875803a682a7776ba852a0f5cf6ff04
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Mon Aug 15 21:14:09 2022 -0700

UniV3 addFee [#256](https://github.com/EnsoFinance/v1-core/pull/256)

commit 2549780eae12ee265c1afc7c2b28f794c4d592f6
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Tue Aug 9 12:28:59 2022 -0700

Redeem synths [#244](https://github.com/EnsoFinance/v1-core/pull/244)

commit 3e4c38b34a893ece67d4b7022a7614792b9ed679
Author: George Carder <georgercarder@gmail.com>
Date:   Mon Aug 8 15:02:03 2022 -0700

some new events and put events in interface [#247](https://github.com/EnsoFinance/v1-core/pull/247)

commit 2a24a6de7773ff29736f3cf2926ab4dc012eb1ce
Author: George Carder <georgercarder@gmail.com>
Date:   Thu Aug 4 17:22:41 2022 -0700

estimate glb is zero [#245](https://github.com/EnsoFinance/v1-core/pull/245)

commit 91e80ba20c7d10774fd031c7cfc1c66479275e71
Author: George Carder <georgercarder@gmail.com>
Date:   Thu Aug 4 10:57:01 2022 -0700

rewardsAdapter only from tokenRegistry [#236](https://github.com/EnsoFinance/v1-core/pull/236)

commit 8ab314240e51841b93071987f7707c58a7e48e3b
Author: George Carder <georgercarder@gmail.com>
Date:   Thu Aug 4 09:08:46 2022 -0700

deprecate proxyExists storage r/w [#243](https://github.com/EnsoFinance/v1-core/pull/243)

commit c8396b30955f71108a76a011655198cb8f92eb4e
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Wed Aug 3 13:50:50 2022 -0700

Consistent token registry [#240](https://github.com/EnsoFinance/v1-core/pull/240)

commit a16d15f05325fc2b68f22d6f1b7faf569c89f55b
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Wed Aug 3 09:31:50 2022 -0700

Prevent deposits on blocked tokens [#230](https://github.com/EnsoFinance/v1-core/pull/230)

commit efcdb8400769046268a1d8afd87c01b21bc1d8a2
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Mon Aug 1 13:56:39 2022 -0700

Clean up names [#233](https://github.com/EnsoFinance/v1-core/pull/233)

commit a58cbc1528fbf4f8bad6960c962fbd7b7f01deb1
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Mon Aug 1 13:48:02 2022 -0700

oracle improvements [#187](https://github.com/EnsoFinance/v1-core/pull/187)

commit e39b3db9527769f81d12331bf077effe0b4c7a1e
Author: George Carder <georgercarder@gmail.com>
Date:   Mon Aug 1 12:24:43 2022 -0700

initialized test [#232](https://github.com/EnsoFinance/v1-core/pull/232)

commit 0f5b9854c9ea7da72e38810a4dc86c69f16d6ec9
Author: George Carder <georgercarder@gmail.com>
Date:   Sun Jul 31 08:55:30 2022 -0700

code4rena gas optimizations [#228](https://github.com/EnsoFinance/v1-core/pull/228)

commit 781799aa9f859af0692362259b7830af729bd7ee
Author: Peter Phillips <19808076+PeterMPhillips@users.noreply.github.com>
Date:   Wed Jul 27 15:00:24 2022 -0700

Fix safe approve [#215](https://github.com/EnsoFinance/v1-core/pull/215)

commit 06e2230ba7d0928e1e2345e0bde09f6a9e069f1d
Author: George Carder <georgercarder@gmail.com>
Date:   Wed Jul 27 14:57:46 2022 -0700

modern rebalance timelock and threshold [#221](https://github.com/EnsoFinance/v1-core/pull/221)


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
