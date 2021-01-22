
const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployUniswap, deployPlatform } = require('./helpers/deploy.js')
const { lookupBalances } = require('./helpers/balances.js')
const { preparePortfolio } = require('./helpers/portfolio.js')
const { getPortfolioTokensUniswap } = require('./helpers/calldata.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('Portfolio', function () {
    let tokens, accounts, uniswapFactory, portfolioFactory, oracle, defaultController, defaultRouter, portfolio, portfolioTokens, portfolioPercentages, portfolioRouters, wrapper, whitelist

    before('Setup Uniswap', async function () {
        accounts = await getSigners();
        [uniswapFactory, tokens] = await deployUniswap(accounts[0], NUM_TOKENS);
        WETH = tokens[0];

        [portfolioFactory, oracle, whitelist, defaultController, defaultRouter] = await deployPlatform(accounts[0], uniswapFactory, WETH);
    })

    it('Should deploy portfolio', async function () {
        console.log('Portfolio factory: ', portfolioFactory.address)
        const positions = [
            { token: tokens[1].address, percentage: 200 },
            { token: tokens[2].address, percentage: 200 },
            { token: tokens[3].address, percentage: 50 },
            { token: tokens[4].address, percentage: 50 },
            { token: tokens[5].address, percentage: 50 },
            { token: tokens[6].address, percentage: 50 },
            { token: tokens[7].address, percentage: 50 },
            { token: tokens[8].address, percentage: 50 },
            { token: tokens[9].address, percentage: 50 },
            { token: tokens[10].address, percentage: 50 },
            { token: tokens[11].address, percentage: 50 },
            { token: tokens[12].address, percentage: 50 },
            { token: tokens[13].address, percentage: 50 },
            { token: tokens[14].address, percentage: 50 },
        ];
        [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, defaultRouter.address);
        let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
            'Test Portfolio',
            'TEST',
            portfolioRouters,
            portfolioTokens,
            portfolioPercentages,
            REBALANCE_THRESHOLD,
            SLIPPAGE,
            TIMELOCK,
            { value: ethers.BigNumber.from('10000000000000000') }
        )
        let receipt = await tx.wait()
        console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

        const portfolioAddress = receipt.events.find(ev => ev.event === 'NewPortfolio').args.portfolio
        const Portfolio = await getContractFactory('Portfolio')
        portfolio = Portfolio.attach(portfolioAddress)

        const LibraryWrapper = await getContractFactory('LibraryWrapper')
        wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
            oracle.address,
            portfolioAddress
        )
        await wrapper.deployed()

        await lookupBalances(wrapper, portfolioTokens, WETH)
        expect(await wrapper.isBalanced()).to.equal(true)
    })

    before('Deploy GenericController', async function () {
        const TRADER = accounts[10]
        const GenericController = await ethers.getContractFactory('GenericController')
        // await GenericController.connect(accounts[4]).deploy()
        genericController = await GenericController.connect(TRADER).deploy()
    })

    it('Should deploy portfolio', async function () {
        console.log('Portfolio factory: ', portfolioFactory.address)
        const positions = [
            { token: tokens[1].address, percentage: 200 },
            { token: tokens[2].address, percentage: 200 },
            { token: tokens[3].address, percentage: 50 },
            { token: tokens[4].address, percentage: 50 },
            { token: tokens[5].address, percentage: 50 },
            { token: tokens[6].address, percentage: 50 },
            { token: tokens[7].address, percentage: 50 },
            { token: tokens[8].address, percentage: 50 },
            { token: tokens[9].address, percentage: 50 },
            { token: tokens[10].address, percentage: 50 },
            { token: tokens[11].address, percentage: 50 },
            { token: tokens[12].address, percentage: 50 },
            { token: tokens[13].address, percentage: 50 },
            { token: tokens[14].address, percentage: 50 },
        ];
        [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, defaultRouter.address);
        // let duplicateTokens = portfolioTokens
        // duplicateTokens[0] = portfolioTokens[1]
        // TODO: portfolio is currently accepting duplicate tokens
        let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
            'Test Portfolio',
            'TEST',
            portfolioRouters,
            portfolioTokens,
            portfolioPercentages,
            REBALANCE_THRESHOLD,
            SLIPPAGE,
            TIMELOCK,
            { value: ethers.BigNumber.from('10000000000000000') }
        )
        let receipt = await tx.wait()
        console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

        const portfolioAddress = receipt.events.find(ev => ev.event === 'NewPortfolio').args.portfolio
        const Portfolio = await getContractFactory('Portfolio')
        portfolio = Portfolio.attach(portfolioAddress)
        /*
        tx = await portfolio.connect(accounts[1]).deposit(portfolioRouters, [], defaultController.address, { value: ethers.BigNumber.from('10000000000000000')})
        receipt = await tx.wait()
        console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
        */
        const LibraryWrapper = await getContractFactory('LibraryWrapper')
        wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
            oracle.address,
            portfolioAddress
        )
        await wrapper.deployed()

        await lookupBalances(wrapper, portfolioTokens, WETH)
        //expect(await portfolio.getPortfolioValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
        expect(await wrapper.isBalanced()).to.equal(true)
    })

    it('Should purchase a token, requiring a rebalance', async function () {
        // Approve the user to use the router
        await whitelist.connect(accounts[0]).approve(accounts[2].address)
        const value = WeiPerEther.mul(50)
        await defaultRouter.connect(accounts[2]).swap(
            value,
            0,
            AddressZero,
            tokens[1].address,
            accounts[2].address,
            accounts[2].address,
            [],
            [],
            { value: value }
        )
        await lookupBalances(wrapper, portfolioTokens, WETH)
        expect(await wrapper.isBalanced()).to.equal(false)
    })

    it('Should fail to rebalance, controller not approved', async function () {
        const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
        const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
        const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
        await expect(portfolio.connect(accounts[1]).rebalance(data, genericController.address))
            .to.be.revertedWith('Controller is not approved')

        await whitelist.approve(genericController.address)
    })

    it('Should rebalance portfolio with genericController', async function () {
        // await genericController.setTarget(portfolio.address)
        const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
        const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()

        const value = WeiPerEther.mul(50)
        let diffs = []
        for (let i = 0; i < estimates.length; i++) {
            const expectedValue = await wrapper.getExpectedTokenValue(total, portfolioTokens[i])
            // console.log('\ntoken: ', i, ' ', portfolioTokens[i])
            // console.log('expected value: ', ethers.utils.formatEther(expectedValue))
            // console.log('actual value: ', ethers.utils.formatEther(estimates[i]))
            if (estimates[i] == expectedValue) continue
            if (estimates[i] > expectedValue) {
                diffs.concat(await defaultRouter.spotPrice((estimates[i] - expectedValue), WETH.address, portfolioTokens[i]))
            }
            else {
                diffs.concat(await defaultRouter.spotPrice((expectedValue - estimates[i]), WETH.address, portfolioTokens[i]))
            }
        }

        // TODO: use delegate call similar to ds proxy instead of holding tokens in multicall
        // genericController grabs initial tokens from uniswap
        // let swapCall = await getPortfolioTokensUniswap(portfolio, genericController, defaultRouter, oracle, value, genericController.address)
        // let swap1 = await genericController.execute(swapCall, { value })
        // const swap1Receipt = await swap1.wait()
        // console.log('Gas Used - ', NUM_TOKENS,' uniswap swaps: ', swap1Receipt.gasUsed.toString())

        // const tx = await portfolio.connect(accounts[1]).rebalance(data, loopController.address)
        // const receipt = await tx.wait()
        // console.log('Gas Used: ', receipt.gasUsed.toString())
        // await lookupBalances(wrapper, portfolioTokens)
        // expect(await wrapper.isBalanced()).to.equal(true)
    })
})