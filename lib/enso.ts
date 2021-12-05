import { ethers } from "hardhat";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
import BalancerFactory from '../artifacts/contracts/test/Balancer.sol/Balancer.json'
import BalancerRegistry from '../artifacts/contracts/test/BalancerRegistry.sol/BalancerRegistry.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import {
	deployTokens,
	deployPlatform,
	deployBalancer,
	deployUniswapV2,
	deployBalancerAdapter,
	deployUniswapV2Adapter,
	deployMetaStrategyAdapter,
	deploySynthetixAdapter,
	deployCurveAdapter,
	deployAaveLendAdapter,
	deployAaveBorrowAdapter,
	deployLeverage2XAdapter,
	deployFullRouter,
	deployLoopRouter,
	deployGenericRouter,
	deployBatchDepositRouter,
	Platform
} from './deploy'
import { MAINNET_ADDRESSES } from './utils'

const { AddressZero, WeiPerEther } = ethers.constants

const NULL_CONTRACT =  new Contract(AddressZero, [], ethers.provider)

export const wethPerToken = (numTokens: number) => BigNumber.from(WeiPerEther).mul(100 * (numTokens - 1))

export type EnsoAdapters = {
	aavelend: Adapter
	aaveborrow: Adapter
	balancer: Adapter
	curve: Adapter
	leverage: Adapter
	synthetix: Adapter
	metastrategy: Adapter
	uniswap: Adapter
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
			wethSupply: wethPerToken(15),
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
			case Adapters.AaveBorrow:
				this.adapters.aaveborrow = adapter
				break
			case Adapters.AaveLend:
				this.adapters.aavelend = adapter
				break
			case Adapters.Balancer:
				this.adapters.balancer = adapter
				break
			case Adapters.Curve:
				this.adapters.curve = adapter
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
		let uniswap = {} as Contract
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
				uniswap = await deployUniswapV2(this.signer, this.tokens)
				break
			case Networks.Mainnet:
				this.tokens[0] = new Contract(MAINNET_ADDRESSES.WETH, WETH9.abi, this.signer)
				this.tokens[0].connect(this.signer)
				this.tokens[1] = new Contract(MAINNET_ADDRESSES.SUSD, ERC20.abi, this.signer)
				this.tokens[1].connect(this.signer)
				this.tokens[2] = new Contract(MAINNET_ADDRESSES.USDC, ERC20.abi, this.signer)
				this.tokens[2].connect(this.signer)
				uniswap = new Contract(MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory.abi, this.signer)
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
				uniswap = new Contract(MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory.abi, this.signer)
		}

		weth = this.tokens[0]
		if (this.tokens[1]) susd = this.tokens[1]
		if (this.tokens[2]) usdc = this.tokens[2]
		// Setup enso based on uniswap + tokens
		const ensoPlatform = await deployPlatform(this.signer, uniswap, weth, susd)
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
		if (this.adapters?.uniswap === undefined) {
			this.addAdapter('uniswap')
		}
		if (this.adapters?.metastrategy === undefined) {
			this.addAdapter('metastrategy')
		}
		if (this.adapters?.leverage !== undefined) {
			// AaveLend and AaveBorrow always needed for leverage
			if (this.adapters?.aavelend === undefined) this.addAdapter('aavelend')
			if (this.adapters?.aaveborrow === undefined) this.addAdapter('aaveborrow')
		}
		// Deploy adapters
		if (this.adapters?.uniswap !== undefined) {
			await this.adapters.uniswap.deploy(this.signer, ensoPlatform, uniswap, weth)
		}
		if (this.adapters?.balancer !== undefined) {
			balancer = await this.deployBalancer()
			await this.adapters.balancer.deploy(this.signer, ensoPlatform, balancer.registry, weth)
		}
		if (this.adapters?.curve !== undefined) {
			await this.adapters.curve.deploy(this.signer, ensoPlatform, new Contract(MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], this.signer), weth)
		}
		if (this.adapters?.aavelend !== undefined) {
			await this.adapters.aavelend.deploy(this.signer, ensoPlatform, new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer), weth)
		}
		if (this.adapters?.aaveborrow !== undefined) {
			await this.adapters.aaveborrow.deploy(this.signer, ensoPlatform, new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer), weth)
		}
		if (this.adapters?.leverage !== undefined) {
			await this.adapters.leverage.deploy(this.signer, ensoPlatform, usdc, weth, this.adapters)
		}
		const fullRouterIndex = this.routers.findIndex(router => router.type == Routers.Full)
		if (this.adapters?.metastrategy !== undefined && fullRouterIndex > -1) {
			await this.adapters.metastrategy.deploy(this.signer, ensoPlatform, this.routers[fullRouterIndex].contract || NULL_CONTRACT, weth)
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
			uniswap,
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
	uniswap: Contract
	tokens: Contract[]
	balancer?: Balancer

	constructor(
		signer: SignerWithAddress,
		defaults: Defaults,
		platform: Platform,
		adapters: EnsoAdapters,
		routers: Router[],
		uniswap: Contract,
		tokens: Contract[],
		balancer?: Balancer
	) {
		this.signer = signer
		this.defaults = defaults
		this.platform = platform
		this.adapters = adapters
		this.routers = routers
		this.uniswap = uniswap
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
	Balancer = 'balancer',
	Curve = 'curve',
	MetaStrategy = 'metastrategy',
	Synthetix = 'synthetix',
	Uniswap = 'uniswap',
	AaveLend = 'aavelend',
	AaveBorrow = 'aaveborrow',
	Leverage = 'leverage'
}

export class Adapter {
	type: Adapters
	contract?: Contract
	constructor(adapterType: string) {
		switch (adapterType.toLowerCase()) {
			case Adapters.AaveBorrow:
				this.type = Adapters.AaveBorrow
				break
			case Adapters.AaveLend:
				this.type = Adapters.AaveLend
				break
			case Adapters.Balancer:
				this.type = Adapters.Balancer
				break
			case Adapters.Curve:
				this.type = Adapters.Curve
				break
			case Adapters.Leverage:
				this.type = Adapters.Leverage
				break
			case Adapters.MetaStrategy:
				this.type = Adapters.MetaStrategy
				break
			case Adapters.Synthetix:
				this.type = Adapters.Synthetix
				break
			case Adapters.Uniswap:
				this.type = Adapters.Uniswap
				break
			default:
				throw Error('Invalid adapter selected!')
		}
	}

	async deploy(signer: SignerWithAddress, platform: Platform, adapterTargetFactory: Contract, weth: Contract, adapters?: EnsoAdapters) {
		if (this.type === Adapters.Uniswap) {
			this.contract = await deployUniswapV2Adapter(signer, adapterTargetFactory, weth)
		} else if (this.type === Adapters.AaveBorrow) {
			this.contract = await deployAaveBorrowAdapter(signer, adapterTargetFactory, weth)
		} else if (this.type === Adapters.AaveLend) {
			this.contract = await deployAaveLendAdapter(signer, adapterTargetFactory, platform.controller, weth)
		} else if (this.type === Adapters.Balancer) {
			this.contract = await deployBalancerAdapter(signer, adapterTargetFactory, weth)
		} else if (this.type === Adapters.Curve) {
			this.contract = await deployCurveAdapter(signer, adapterTargetFactory, weth)
		} else if (this.type === Adapters.Leverage && adapters !== undefined) {
			this.contract = await deployLeverage2XAdapter(
				signer,
				adapters.uniswap.contract || NULL_CONTRACT,
				adapters.aavelend.contract || NULL_CONTRACT,
				adapters.aaveborrow.contract || NULL_CONTRACT,
				adapterTargetFactory,
				weth
			)
		} else if (this.type === Adapters.Synthetix) {
			this.contract = await deploySynthetixAdapter(signer, adapterTargetFactory, weth)
		} else if (this.type === Adapters.MetaStrategy){
			this.contract = await deployMetaStrategyAdapter(
				signer,
				platform.controller,
				adapterTargetFactory,
				weth
			)
		}
		if (this.contract !== undefined) await platform.administration.whitelist.connect(signer).approve(this.contract.address)
	}
}

export enum Routers {
	Generic,
	Loop,
	Full,
	Batch
}

// TODO: implement encoding for each Router (chain calldata for each type of router GenericRouter is IRouter, LoopRouter is IRouter etc..)
export class Router {
	type: Routers
	contract?: Contract
	constructor(routerType: string) {
		switch (routerType.toLowerCase()) {
			case 'generic' || 'genericrouter':
				this.type = Routers.Generic
				break
			case 'full' || 'fullrouter':
				this.type = Routers.Full
				break
			case 'loop' || 'looprouter':
				this.type = Routers.Loop
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
		if (this.type == Routers.Generic) {
			this.contract = await deployGenericRouter(signer, controller)
		} else if (this.type == Routers.Full) {
			this.contract = await deployFullRouter(signer, new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], ethers.provider), controller, library)
		} else if (this.type == Routers.Batch) {
			this.contract = await deployBatchDepositRouter(signer, controller, library)
		} else {
			this.contract = await deployLoopRouter(signer, controller, library)
		}
	}
}
