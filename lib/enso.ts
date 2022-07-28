import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
import BalancerFactory from '../artifacts/contracts/test/Balancer.sol/Balancer.json'
import BalancerRegistry from '../artifacts/contracts/test/BalancerRegistry.sol/BalancerRegistry.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import UniswapV3Router from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import {
	deployTokens,
	deployPlatform,
	deployBalancer,
	deployUniswapV2,
	deployUniswapV3,
	deployBalancerAdapter,
	deployUniswapV2Adapter,
	deployUniswapV3Adapter,
	deployMetaStrategyAdapter,
	deploySynthetixAdapter,
	deployCompoundAdapter,
	deployCurveAdapter,
	deployCurveLPAdapter,
	deployCurveGaugeAdapter,
	deployAaveV2Adapter,
	deployAaveV2DebtAdapter,
	deployLeverage2XAdapter,
	deployYEarnAdapter,
	deployFullRouter,
	deployLoopRouter,
	deployMulticallRouter,
	deployBatchDepositRouter,
	Platform
} from './deploy'
import { MAINNET_ADDRESSES, ESTIMATOR_CATEGORY } from './constants'

const { AddressZero, WeiPerEther } = ethers.constants

const NULL_CONTRACT =  new Contract(AddressZero, [], ethers.provider)

export const wethPerToken = (numTokens: number) => BigNumber.from(WeiPerEther).mul(100 * (numTokens - 1))

export type EnsoAdapters = {
	aaveV2: Adapter
	aaveV2Debt: Adapter
	balancer: Adapter
	compound: Adapter
	curve: Adapter
	curveLP: Adapter
	curveGauge: Adapter
	leverage: Adapter
	synthetix: Adapter
	metastrategy: Adapter
	uniswap: Adapter
	uniswapV2: Adapter
	uniswapV3: Adapter
	yearnV2: Adapter
}

export class EnsoBuilder {
	signer: SignerWithAddress
	defaults: Defaults
	tokens?: Contract[]
	network?: Networks
	routers?: Router[]
	adapters?: EnsoAdapters
	public constructor(signer: SignerWithAddress) {
		this.signer = signer
		this.defaults = {
			threshold: 10,
			slippage: 995,
			timelock: 60,
			numTokens: 15,
			wethSupply: wethPerToken(100),
		} as Defaults
	}
	public mainnet() {
		this.network = Networks.Mainnet
		return this
	}
	public testnet() {
		this.network = Networks.LocalTestnet
		return this
	}
	public setDefaults(defaults: Defaults) {
		this.defaults = defaults
	}
	public addRouter(type: string) {
		this.routers = this.routers ?? ([] as Router[])
		this.routers.push(new Router(type))
		return this
	}
	public addAdapter(type: string) {
		this.adapters = this.adapters ?? ({} as EnsoAdapters)
		const adapter = new Adapter(type)
		switch (adapter.type) {
			case Adapters.AaveV2Debt:
				this.adapters.aaveV2Debt = adapter
				break
			case Adapters.AaveV2:
				this.adapters.aaveV2 = adapter
				break
			case Adapters.Balancer:
				this.adapters.balancer = adapter
				break
			case Adapters.Compound:
				this.adapters.compound = adapter
				break
			case Adapters.Curve:
				this.adapters.curve = adapter
				break
			case Adapters.CurveLP:
				this.adapters.curveLP = adapter
				break
			case Adapters.CurveGauge:
				this.adapters.curveGauge = adapter
				break
			case Adapters.Leverage:
				this.adapters.leverage = adapter
				break
			case Adapters.Synthetix:
				this.adapters.synthetix = adapter
				break
			case Adapters.MetaStrategy:
				this.adapters.metastrategy = adapter
				break
			case Adapters.Uniswap:
				this.adapters.uniswap = adapter
				break
			case Adapters.UniswapV2:
				this.adapters.uniswapV2 = adapter
				break
			case Adapters.UniswapV3:
				this.adapters.uniswapV3 = adapter
				break
			case Adapters.YEarnV2:
				this.adapters.yearnV2 = adapter
				break
			default:
				throw Error('Invalid adapter type')
		}
		return this
	}
	private async deployBalancer(): Promise<Balancer> {
		if (this.tokens === undefined) throw Error('Tried deploying balancer with no erc20 tokens')
		let balancer = {} as Balancer
		let factory = {} as Contract
		let registry = {} as Contract
		switch (this.network) {
			case Networks.LocalTestnet:
				[factory, registry] = await deployBalancer(this.signer, this.tokens)
				balancer = new Balancer(factory, registry)
				break
			case Networks.Mainnet:
				factory = new Contract(
					MAINNET_ADDRESSES.BALANCER_FACTORY,
					BalancerFactory.abi,
					this.signer
				)
				registry = new Contract(
					MAINNET_ADDRESSES.BALANCER_REGISTRY,
					BalancerRegistry.abi,
					this.signer
				)
				balancer = new Balancer(factory, registry)
				break
			case Networks.ExternalTestnet:
				throw Error('External testnet not implemented yet')
			default:
				factory = new Contract(
					MAINNET_ADDRESSES.BALANCER_FACTORY,
					BalancerFactory.abi,
					this.signer
				)
				registry = new Contract(
					MAINNET_ADDRESSES.BALANCER_REGISTRY,
					BalancerRegistry.abi,
					this.signer
				)
				balancer = new Balancer(factory, registry)
				break
		}
		return balancer
	}

	// Defaults to Mainnet-fork
	// Defaults to Mainnet-fork
	public async build(): Promise<EnsoEnvironment> {
		let weth = {} as Contract
		let susd = {} as Contract
		let usdc = {} as Contract
		let uniswapV2Factory = {} as Contract
		let uniswapV3Factory = {} as Contract
		let uniswapV3Router = {} as Contract
		let balancer = {} as Balancer
		this.tokens = this.tokens ?? ([] as Contract[])
		this.adapters = this.adapters ?? ({} as EnsoAdapters)
		this.routers = this.routers ?? ([] as Router[])
		this.network = this.network ?? Networks.Mainnet
		console.log('Setting up EnsoEnvironment on: ', this.network)
		// Deploy or Connect to Erc20's/Uniswap/Balancer/etc for the provided network
		switch (this.network) {
			case Networks.LocalTestnet:
				this.tokens = await deployTokens(this.signer, this.defaults.numTokens, this.defaults.wethSupply)
				if (this.tokens === undefined) throw Error('Failed to deploy erc20 tokens')
				uniswapV2Factory = await deployUniswapV2(this.signer, this.tokens);
				[uniswapV3Factory, ] = await deployUniswapV3(this.signer, this.tokens)
				uniswapV3Router = await waffle.deployContract(this.signer, UniswapV3Router, [uniswapV3Factory.address, this.tokens[0].address])
				break
			case Networks.Mainnet:
				this.tokens[0] = new Contract(MAINNET_ADDRESSES.WETH, WETH9.abi, this.signer)
				this.tokens[0].connect(this.signer)
				this.tokens[1] = new Contract(MAINNET_ADDRESSES.SUSD, ERC20.abi, this.signer)
				this.tokens[1].connect(this.signer)
				this.tokens[2] = new Contract(MAINNET_ADDRESSES.USDC, ERC20.abi, this.signer)
				this.tokens[2].connect(this.signer)
				uniswapV2Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, this.signer)
				uniswapV3Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, UniswapV3Factory.abi, this.signer)
				uniswapV3Router = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_ROUTER, UniswapV3Router.abi, this.signer)
				break
			case Networks.ExternalTestnet:
				throw Error('External testnet not implemented yet')
			default:
				this.tokens[0] = new Contract(MAINNET_ADDRESSES.WETH, WETH9.abi, this.signer)
				this.tokens[0].connect(this.signer)
				this.tokens[1] = new Contract(MAINNET_ADDRESSES.SUSD, ERC20.abi, this.signer)
				this.tokens[1].connect(this.signer)
				this.tokens[2] = new Contract(MAINNET_ADDRESSES.USDC, ERC20.abi, this.signer)
				this.tokens[2].connect(this.signer)
				uniswapV2Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, this.signer)
				uniswapV3Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, UniswapV3Factory.abi, this.signer)
				uniswapV3Router = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_ROUTER, UniswapV3Router.abi, this.signer)
		}

		weth = this.tokens[0]
		if (this.tokens[1]) susd = this.tokens[1]
		if (this.tokens[2]) usdc = this.tokens[2]
		// Setup enso based on uniswap + tokens
		const ensoPlatform = await deployPlatform(this.signer, uniswapV3Factory, uniswapV3Factory, weth, susd)
		ensoPlatform.print()

		// Provide all routers by default
		if (this.routers.length === 0) {
			this.addRouter('generic')
			this.addRouter('loop')
			this.addRouter('full')
			this.addRouter('batch')
		}
		this.routers = await Promise.all(
			this.routers.map(async r => {
				await r.deploy(this.signer, ensoPlatform.controller, ensoPlatform.library)
				await ensoPlatform.administration.whitelist.connect(this.signer).approve(r.contract?.address)
				return r
			})
		)

		// We need uniswap
		if (this.adapters?.uniswap === undefined && this.adapters?.uniswapV2 === undefined) {
			this.addAdapter('uniswap')
		}
		if (this.adapters?.metastrategy === undefined) {
			this.addAdapter('metastrategy')
		}
		if (this.adapters?.leverage !== undefined) {
			// AaveV2 and AaveV2Debt always needed for leverage
			if (this.adapters?.aaveV2 === undefined) this.addAdapter('aavev2')
			if (this.adapters?.aaveV2Debt === undefined) this.addAdapter('aavev2debt')
		}
		// Deploy adapters
		if (this.adapters?.aaveV2 !== undefined) {
			await this.adapters.aaveV2.deploy(this.signer, ensoPlatform.administration.whitelist, [new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer), ensoPlatform.controller, weth, ensoPlatform.oracles.registries.tokenRegistry, ESTIMATOR_CATEGORY.AAVE_V2])
		}
		if (this.adapters?.aaveV2Debt !== undefined) {
			await this.adapters.aaveV2Debt.deploy(this.signer, ensoPlatform.administration.whitelist, [new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer), weth])
		}
		if (this.adapters?.balancer !== undefined) {
			balancer = await this.deployBalancer()
			await this.adapters.balancer.deploy(this.signer, ensoPlatform.administration.whitelist, [balancer.registry, weth])
		}
		if (this.adapters?.compound !== undefined) {
			await this.adapters.compound.deploy(this.signer, ensoPlatform.administration.whitelist, [new Contract(MAINNET_ADDRESSES.COMPOUND_COMPTROLLER, [], this.signer), weth, ensoPlatform.oracles.registries.tokenRegistry, ESTIMATOR_CATEGORY.COMPOUND])
		}
		if (this.adapters?.curve !== undefined) {
			await this.adapters.curve.deploy(this.signer, ensoPlatform.administration.whitelist, [new Contract(MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], this.signer), weth])
		}
		if (this.adapters?.curveLP !== undefined) {
			await this.adapters.curveLP.deploy(this.signer, ensoPlatform.administration.whitelist, [
				new Contract(MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], this.signer),
				ensoPlatform.oracles.registries.curveDepositZapRegistry,
				weth
			])
		}
		if (this.adapters?.curveGauge !== undefined) {
			await this.adapters.curveGauge.deploy(this.signer, ensoPlatform.administration.whitelist, [weth, ensoPlatform.oracles.registries.tokenRegistry, ESTIMATOR_CATEGORY.CURVE_GAUGE])
		}
		if (this.adapters?.synthetix !== undefined) {
			await this.adapters.synthetix.deploy(this.signer, ensoPlatform.administration.whitelist, [new Contract(MAINNET_ADDRESSES.SYNTHETIX_ADDRESS_PROVIDER, [], this.signer), weth])
		}
		if (this.adapters?.uniswap !== undefined) {
			await this.adapters.uniswap.deploy(this.signer, ensoPlatform.administration.whitelist, [uniswapV2Factory, weth])
		}
		if (this.adapters?.uniswapV2 !== undefined) {
			await this.adapters.uniswapV2.deploy(this.signer, ensoPlatform.administration.whitelist, [uniswapV2Factory, weth])
		}
		if (this.adapters?.uniswapV3 !== undefined) {
			await this.adapters.uniswapV3.deploy(this.signer, ensoPlatform.administration.whitelist, [ensoPlatform.oracles.registries.uniswapV3Registry, uniswapV3Router, weth])
		}
		if (this.adapters?.yearnV2 !== undefined) {
			await this.adapters.yearnV2.deploy(this.signer, ensoPlatform.administration.whitelist, [weth, ensoPlatform.oracles.registries.tokenRegistry, ESTIMATOR_CATEGORY.YEARN_V2])
		}
		// Goes last since it depends on other adapters
		if (this.adapters?.leverage !== undefined) {
			await this.adapters.leverage.deploy(this.signer, ensoPlatform.administration.whitelist, [
				this.adapters?.uniswap.contract || NULL_CONTRACT,
				this.adapters?.aaveV2.contract || NULL_CONTRACT,
				this.adapters?.aaveV2Debt.contract || NULL_CONTRACT,
				new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer),
				usdc,
				weth
			])
		}
		const fullRouterIndex = this.routers.findIndex(router => router.type == Routers.Full)
		if (this.adapters?.metastrategy !== undefined && fullRouterIndex > -1) {
			await this.adapters.metastrategy.deploy(this.signer, ensoPlatform.administration.whitelist, [ensoPlatform.controller, this.routers[fullRouterIndex].contract || NULL_CONTRACT, weth])
		}

		// Safety check
		if (this.adapters === undefined) throw Error('Failed to add adapters')
		if (this.routers === undefined) throw Error('Failed to deploy routers')
		return new EnsoEnvironment(
			this.signer,
			this.defaults,
			ensoPlatform,
			this.adapters,
			this.routers,
			uniswapV2Factory,
			this.tokens,
			balancer
		)
	}
}

// TODO: move adapters + routers into enso.Platform object
export class EnsoEnvironment {
	signer: SignerWithAddress
	defaults: Defaults
	platform: Platform
	adapters: EnsoAdapters
	routers: Router[]
	uniswapV2Factory: Contract
	tokens: Contract[]
	balancer?: Balancer

	constructor(
		signer: SignerWithAddress,
		defaults: Defaults,
		platform: Platform,
		adapters: EnsoAdapters,
		routers: Router[],
		uniswapV2Factory: Contract,
		tokens: Contract[],
		balancer?: Balancer
	) {
		this.signer = signer
		this.defaults = defaults
		this.platform = platform
		this.adapters = adapters
		this.routers = routers
		this.uniswapV2Factory = uniswapV2Factory
		this.tokens = tokens
		this.balancer = balancer === undefined ? balancer : undefined
	}
}

export class Balancer {
	factory: Contract
	registry: Contract
	constructor(factory: Contract, registry: Contract) {
		this.factory = factory
		this.registry = registry
	}
}
export enum Networks {
	Mainnet = 'Mainnet',
	LocalTestnet = 'LocalTestnet',
	ExternalTestnet = 'ExternalTestnet',
}

export type Defaults = {
	threshold: number
	slippage: number
	timelock: number
	numTokens: number
	wethSupply: BigNumber
}

export enum Adapters {
	AaveV2 = 'aavev2',
	AaveV2Debt = 'aavev2debt',
	Balancer = 'balancer',
	Compound = 'compound',
	Curve = 'curve',
	CurveLP = 'curvelp',
	CurveGauge = 'curvegauge',
	Leverage = 'leverage',
	MetaStrategy = 'metastrategy',
	Synthetix = 'synthetix',
	Uniswap = 'uniswap',
	UniswapV2 = 'uniswapv2',
	UniswapV3 = 'uniswapv3',
	YEarnV2 = 'yearnv2'
}

export class Adapter {
	type: Adapters
	contract?: Contract
	constructor(adapterType: string) {
		const isAdapter = Object.values(Adapters).findIndex((v: string) => v === adapterType.toLowerCase()) !== -1
		if (isAdapter) {
			this.type = <Adapters> adapterType.toLowerCase()
		} else {
			throw Error('Invalid adapter selected!')
		}
	}

	async deploy(signer: SignerWithAddress, whitelist: Contract, parameters: any[]) {
		if (this.type === Adapters.AaveV2Debt) {
			if (parameters.length == 2)
				this.contract = await deployAaveV2DebtAdapter(signer, parameters[0], parameters[1])
		} else if (this.type === Adapters.AaveV2) {
			if (parameters.length == 5)
				this.contract = await deployAaveV2Adapter(signer, parameters[0], parameters[1], parameters[2], parameters[3], parameters[4])
		} else if (this.type === Adapters.Balancer) {
			if (parameters.length == 2)
				this.contract = await deployBalancerAdapter(signer, parameters[0], parameters[1])
		} else if (this.type === Adapters.Compound) {
			if (parameters.length == 4)
				this.contract = await deployCompoundAdapter(signer, parameters[0], parameters[1], parameters[2], parameters[3])
		} else if (this.type === Adapters.Curve) {
			if (parameters.length == 2)
				this.contract = await deployCurveAdapter(signer, parameters[0], parameters[1])
		} else if (this.type === Adapters.CurveLP) {
			if (parameters.length == 3)
				this.contract = await deployCurveLPAdapter(signer, parameters[0], parameters[1], parameters[2])
		} else if (this.type === Adapters.CurveGauge) {
			if (parameters.length == 3)
				this.contract = await deployCurveGaugeAdapter(signer, parameters[0], parameters[1], parameters[2])
		} else if (this.type === Adapters.Leverage) {
			if (parameters.length == 6)
				this.contract = await deployLeverage2XAdapter(signer, parameters[0], parameters[1], parameters[2], parameters[3], parameters[4], parameters[5])
		} else if (this.type === Adapters.Synthetix) {
			if (parameters.length == 2)
				this.contract = await deploySynthetixAdapter(signer, parameters[0], parameters[1])
		} else if (this.type === Adapters.MetaStrategy){
			if (parameters.length == 3)
				this.contract = await deployMetaStrategyAdapter(signer, parameters[0], parameters[1], parameters[2])
		} else if (this.type === Adapters.Uniswap) {
			if (parameters.length == 2)
				this.contract = await deployUniswapV2Adapter(signer, parameters[0], parameters[1])
		} else if (this.type === Adapters.UniswapV2) {
			if (parameters.length == 2)
				this.contract = await deployUniswapV2Adapter(signer, parameters[0], parameters[1])
		} else if (this.type === Adapters.UniswapV3) {
			if (parameters.length == 3)
				this.contract = await deployUniswapV3Adapter(signer, parameters[0], parameters[1], parameters[2])
		} else if (this.type === Adapters.YEarnV2) {
			if (parameters.length == 3)
				this.contract = await deployYEarnAdapter(signer, parameters[0], parameters[1], parameters[2])
		}
		if (this.contract !== undefined) await whitelist.connect(signer).approve(this.contract.address)
	}
}

export enum Routers {
	Multicall,
	Loop,
	Full,
	Batch
}

// TODO: implement encoding for each Router (chain calldata for each type of router MulticallRouter is IRouter, LoopRouter is IRouter etc..)
export class Router {
	type: Routers
	contract?: Contract
	constructor(routerType: string) {
		switch (routerType.toLowerCase()) {
			case 'generic' || 'genericrouter' || 'multicall' || 'multicallrouter':
				this.type = Routers.Multicall
				break
			case 'loop' || 'looprouter':
				this.type = Routers.Loop
				break
			case 'full' || 'fullrouter':
				this.type = Routers.Full
				break
			case 'batch' || 'batchrouter' || 'batchdepositrouter':
				this.type = Routers.Loop
				break
			default:
				throw Error(
					'failed to parse router type: ensobuilder.withrouter() accepted input: generic/loop || genericrouter/looprouter'
				)
		}
	}

	async deploy(signer: SignerWithAddress, controller: Contract, library: Contract) {
		if (this.type == Routers.Multicall) {
			this.contract = await deployMulticallRouter(signer, controller)
		} else if (this.type == Routers.Full) {
			this.contract = await deployFullRouter(signer, new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], ethers.provider), controller, library)
		} else if (this.type == Routers.Batch) {
			this.contract = await deployBatchDepositRouter(signer, controller, library)
		} else {
			this.contract = await deployLoopRouter(signer, controller, library)
		}
	}
}
