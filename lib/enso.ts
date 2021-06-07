const hre = require('hardhat')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
const { MAINNET_ADDRESSES } = require('./utils')
const WETH9 = require('@uniswap/v2-periphery/build/WETH9.json')
const UniswapV2Factory = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const {
	deployTokens,
	deployPlatform,
	deployUniswapV2,
	deployUniswapV2Adapter,
	deployLoopRouter,
	deployGenericRouter,
} = require('./deploy')
import { deployBalancer, deployBalancerAdapter, Platform } from './deploy'
const { ethers, waffle } = hre
const { constants } = ethers
const { WeiPerEther } = constants
const { getContractFactory } = waffle

export const wethPerToken = (numTokens: number) => WeiPerEther.mul(100 * (numTokens - 1))

export type EnsoAdapters = {
	uniswap: Adapter
	balancer: Adapter
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
			case Adapters.Uniswap:
				this.adapters.uniswap = adapter
				break
			case Adapters.Balancer:
				this.adapters.balancer = adapter
				break
			default:
				throw Error('Invalid adapter type')
		}
	}
	private async deployBalancer(): Promise<Balancer> {
		if (this.tokens === undefined) throw Error('Tried deploying balancer with no erc20 tokens')
		let balancerFactory = {} as Contract
		let balancerRegistry = {} as Contract
		const BalancerFactory = await getContractFactory('Balancer')
		const BalancerRegistry = await getContractFactory('BalancerRegistry')
		let balancer = {} as Balancer
		switch (this.network) {
			case Networks.LocalTestnet:
				const [factory, registry] = await deployBalancer(this.signer, this.tokens)
				balancer = new Balancer(factory, registry)
				break
			case Networks.Mainnet:
				balancerFactory = await BalancerFactory.connect(this.signer).deploy()
				await balancerFactory.deployed()
				balancerRegistry = await BalancerRegistry.connect(this.signer).deploy(balancerFactory.address)
				await balancerRegistry.deployed()
				balancer = new Balancer(MAINNET_ADDRESSES.BALANCER_FACTORY, MAINNET_ADDRESSES.BALANCER_REGISTRY)
				break
			case Networks.ExternalTestnet:
				throw Error('External testnet not implemented yet')
			default:
				balancerFactory = await BalancerFactory.connect(this.signer).deploy()
				await balancerFactory.deployed()
				balancerRegistry = await BalancerRegistry.connect(this.signer).deploy(balancerFactory.address)
				await balancerRegistry.deployed()
				balancer = new Balancer(MAINNET_ADDRESSES.BALANCER_FACTORY, MAINNET_ADDRESSES.BALANCER_REGISTRY)
				break
		}
		return balancer
	}

	// Defaults to Mainnet-fork
	public async build(): Promise<EnsoEnvironment> {
		let weth = {} as Contract
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
				uniswap = new Contract(MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory.abi, this.signer)
				break
			case Networks.ExternalTestnet:
				throw Error('External testnet not implemented yet')
			default:
				this.tokens[0] = new Contract(MAINNET_ADDRESSES.WETH, JSON.stringify(WETH9.abi), this.signer)
				this.tokens[0].connect(this.signer)
				uniswap = new Contract(MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory.abi, this.signer)
		}

		weth = this.tokens[0]
		// Setup enso based on uniswap + tokens
		const ensoPlatform = await deployPlatform(this.signer, uniswap, weth)
		ensoPlatform.print()

		// We need uniswap
		if (this.adapters?.uniswap === undefined) {
			this.addAdapter('uniswap')
		}
		// Deploy adapters
		if (this.adapters?.uniswap !== undefined) {
			await this.adapters.uniswap.deploy(this.signer, uniswap, weth)
		}
		if (this.adapters?.balancer !== undefined) {
			balancer = await this.deployBalancer()
			await this.adapters.balancer.deploy(this.signer, balancer.registry, weth)
		}

		// Provide all routers by default
		if (this.routers === undefined) {
			this.addRouter('generic')
			this.addRouter('loop')
		}
		this.routers?.forEach(async (r) => {
			await r.deploy(this.signer, ensoPlatform.controller, weth, this.adapters?.uniswap.contract)
			await ensoPlatform.whitelist.connect(this.signer).approve(r.contract?.address)
		})

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
	enso: Platform
	adapters: EnsoAdapters
	routers: Router[]
	uniswap: Contract
	tokens: Contract[]
	balancer?: Balancer

	constructor(
		signer: SignerWithAddress,
		defaults: Defaults,
		enso: Platform,
		adapters: EnsoAdapters,
		routers: Router[],
		uniswap: Contract,
		tokens: Contract[],
		balancer?: Balancer
	) {
		this.signer = signer
		this.defaults = defaults
		this.enso = enso
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
	Uniswap = 'uniswap',
	Balancer = 'balancer',
}

export class Adapter {
	type: Adapters
	contract?: Contract
	constructor(adapterType: string) {
		switch (adapterType.toLowerCase()) {
			case Adapters.Uniswap:
				this.type = Adapters.Uniswap
				break
			case Adapters.Balancer:
				this.type = Adapters.Uniswap
				break
			default:
				throw Error('Invalid adapter selected! Accepted inputs: uniswap/balancer')
		}
	}

	async deploy(signer: SignerWithAddress, adapterTargetFactory: Contract, weth: Contract) {
		if (this.type === Adapters.Uniswap) {
			this.contract = await deployUniswapV2Adapter(signer, adapterTargetFactory, weth)
		} else {
			this.contract = await deployBalancerAdapter(signer, adapterTargetFactory, weth)
		}
	}
}

export enum Routers {
	Generic,
	Loop,
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
			case 'loop' || 'looprouter':
				this.type = Routers.Loop
				break
			default:
				throw Error(
					'failed to parse router type: ensobuilder.withrouter() accepted input: generic/loop || genericrouter/looprouter'
				)
		}
	}

	async deploy(signer: SignerWithAddress, controller: Contract, weth: Contract, adapter?: Contract) {
		if (this.type == Routers.Generic) {
			this.contract = await deployGenericRouter(signer, controller, weth)
		} else {
			if (adapter === undefined) throw Error("Didn't pass adapter to Router.deploy()")
			this.contract = await deployLoopRouter(signer, controller, adapter, weth)
		}
	}
}
