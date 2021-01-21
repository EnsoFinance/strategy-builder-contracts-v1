const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const WETH9 = require('@uniswap/v2-periphery/build/WETH9.json')
const UniswapV2Factory = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const UniswapV2Pair = require('@uniswap/v2-core/build/UniswapV2Pair.json')
const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { deployContract, provider } = waffle
const { constants, Contract } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 15
let WETH;
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks

async function lookupBalances(wrapper, tokens) {
    const total = (await wrapper.getPortfolioValue()).toString()
    console.log('Total: ', total)
    const balanceETH = BigNumber((await wrapper.getTokenValue(AddressZero)).toString())
    const percentETH = balanceETH.times(100).div(total)
    console.log('ETH Balance: ', balanceETH.toString())
    console.log('ETH Percent: ', `${percentETH.toFixed(2)}%`)
    const balanceWETH = BigNumber((await wrapper.getTokenValue(WETH)).toString())
    const percentWETH = balanceWETH.times(100).div(total)
    console.log('WETH Balance: ', balanceWETH.toString())
    console.log('WETH Percent: ', `${percentWETH.toFixed(2)}%`)
    for (let i = 0; i < tokens.length; i++) {
        const balance = BigNumber((await wrapper.getTokenValue(tokens[i])).toString())
        const percent = balance.times(100).div(total)
        console.log(`TOK${i} Balance: `, balance.toString())
        console.log(`TOK${i} Percent: `, `${percent.toFixed(4)}%`)
    }
}

describe('Portfolio', function () {
    const tokens = []
    let Portfolio
    let accounts, uniswapFactory, uniswapRouter, portfolioFactory, oracle, loopController, flashController, portfolio, portfolioTokens, portfolioPercentages, portfolioRouters, wrapper, whitelist

    before('Setup Uniswap', async function () {
        accounts = await ethers.getSigners()
        uniswapFactory = await deployContract(accounts[0], UniswapV2Factory, [accounts[0].address])
        console.log('Uniswap factory: ', uniswapFactory.address)
        for (let i = 0; i < NUM_TOKENS; i++) {
            if (i === 0) {
                const token = await deployContract(accounts[0], WETH9)
                token.deposit({ value: WeiPerEther.mul(100 * (NUM_TOKENS - 1)) })
                tokens.push(token)
                WETH = token.address
                console.log("Weth: ", WETH)
            } else {
                const token = await deployContract(accounts[0], ERC20, [WeiPerEther.mul(10000)])
                tokens.push(token)
                await uniswapFactory.createPair(tokens[0].address, token.address)
                const pairAddress = await uniswapFactory.getPair(tokens[0].address, token.address)
                console.log("Uniswap Pair: ", pairAddress);
                const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider)
                // Add liquidity
                await tokens[0].transfer(pairAddress, WeiPerEther.mul(100))
                await token.transfer(pairAddress, WeiPerEther.mul(100))
                await pair.connect(accounts[0]).mint(accounts[0].address)
            }
        }

        const Whitelist = await ethers.getContractFactory('TestWhitelist')
        whitelist = await Whitelist.connect(accounts[0]).deploy()
        await whitelist.deployed()
        console.log("Whitelist: ", whitelist.address)

        const UniswapRouter = await ethers.getContractFactory('UniswapRouter')
        uniswapRouter = await UniswapRouter.connect(accounts[0]).deploy(
            uniswapFactory.address,
            tokens[0].address,
            whitelist.address
        )
        await uniswapRouter.deployed()

        const UniswapFlashController = await ethers.getContractFactory('UniswapFlashController')
        flashController = await UniswapFlashController.connect(accounts[0]).deploy(
            uniswapRouter.address,
            uniswapFactory.address,
            tokens[0].address
        )
        await flashController.deployed()
        await whitelist.connect(accounts[0]).approve(flashController.address)

        const LoopController = await ethers.getContractFactory('LoopController')
        loopController = await LoopController.connect(accounts[0]).deploy(
            uniswapRouter.address,
            uniswapFactory.address,
            tokens[0].address
        )
        await loopController.deployed()
        await whitelist.connect(accounts[0]).approve(loopController.address)

        Portfolio = await ethers.getContractFactory('Portfolio')
        const portfolioImplementation = await Portfolio.connect(accounts[0]).deploy()
        await portfolioImplementation.deployed()

        const Oracle = await ethers.getContractFactory('TestOracle')
        oracle = await Oracle.connect(accounts[0]).deploy(
            uniswapFactory.address,
            tokens[0].address
        )
        await oracle.deployed()

        const PortfolioProxyFactory = await ethers.getContractFactory('PortfolioProxyFactory')
        portfolioFactory = await PortfolioProxyFactory.connect(accounts[0]).deploy(
            portfolioImplementation.address,
            oracle.address,
            whitelist.address
        )
        await portfolioFactory.deployed()
    })


    before('Deploy GenericController', async function () {
        const TRADER = accounts[10]
        const Multicall = await ethers.getContractFactory('GenericController')
        await Multicall.connect(accounts[4]).deploy()
        await Multicall.connect(TRADER).deploy()
    })


    xit('Should deploy portfolio', async function () {
        console.log('Portfolio factory: ', portfolioFactory.address)
        portfolioTokens = [
            tokens[1].address,
            tokens[2].address,
            tokens[3].address,
            tokens[4].address,
            tokens[5].address,
            tokens[6].address,
            tokens[7].address,
            tokens[8].address,
            tokens[9].address,
            tokens[10].address,
            tokens[11].address,
            tokens[12].address,
            tokens[13].address,
            tokens[14].address
        ]
        //Percentages are multiples of 1000, so 20% = 0.2 = 200
        portfolioPercentages = [
            200,
            200,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50
        ]
        portfolioRouters = []
        for (let i = 0; i < portfolioTokens.length; i++) portfolioRouters.push(uniswapRouter.address)
        let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
            'Test Portfolio',
            'TEST',
            portfolioTokens,
            portfolioPercentages,
            REBALANCE_THRESHOLD,
            SLIPPAGE,
            TIMELOCK
        )
        let receipt = await tx.wait()
        console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

        const portfolioAddress = receipt.events.find(ev => ev.event === 'NewPortfolio').args.portfolio
        portfolio = Portfolio.attach(portfolioAddress)

        tx = await portfolio.connect(accounts[1]).deposit(portfolioRouters, [], loopController.address, { value: ethers.BigNumber.from('10000000000000000') })
        receipt = await tx.wait()
        console.log('Deposit Gas Used: ', receipt.gasUsed.toString())

        const LibraryWrapper = await ethers.getContractFactory('LibraryWrapper')
        wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
            oracle.address,
            portfolioAddress
        )
        await wrapper.deployed()
        await lookupBalances(wrapper, portfolioTokens)
        //expect(await portfolio.getPortfolioValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
        expect(await wrapper.isBalanced()).to.equal(true)

    })

    xit('Should purchase a token, requiring a rebalance', async function () {
        // Approve the user to use the router
        await whitelist.connect(accounts[0]).approve(accounts[2].address)
        const value = WeiPerEther.mul(50)
        await uniswapRouter.connect(accounts[2]).swap(
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
        await lookupBalances(wrapper, portfolioTokens)
        expect(await wrapper.isBalanced()).to.equal(false)
    })

    xit('Should rebalance portfolio with multicall', async function () {
        const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
        const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
        console.log('Rebalancing portfolio....')
        let diffs = []
        for (let i = 0; i < estimates.length; i++) {
            const expectedValue = await wrapper.getExpectedTokenValue(total, portfolioTokens[i])
            console.log('\ntoken: ', i, ' ', portfolioTokens[i])
            console.log('expected value: ', ethers.utils.formatEther(expectedValue))
            console.log('actual value: ', ethers.utils.formatEther(estimates[i]))
            if (estimates[i] == expectedValue) continue
            if (estimates[i] > expectedValue) {
                diffs.concat(await uniswapRouter.spotPrice((estimates[i] - expectedValue), WETH, portfolioTokens[i]))
            }
            else {
                diffs.concat(await uniswapRouter.spotPrice((expectedValue - estimates[i]), WETH, portfolioTokens[i]))
            }

        }

        // Multicall gets initial tokens from uniswap
        // let swapCall = await getPortfolioTokensUniswap(portfolio, multicall, uniswapRouter, oracle, portfolioDepositWeth, multicall.address)
        // let swap1 = await multicall.execute(swapCall, { value: portfolioDepositWeth })
        // const swap1Receipt = await swap1.wait()
        // console.log('Gas Used - batch uniswap swaps: ', swap1Receipt.gasUsed.toString())

        // const tx = await portfolio.connect(accounts[1]).rebalance(data, loopController.address)
        // const receipt = await tx.wait()
        // console.log('Gas Used: ', receipt.gasUsed.toString())
        // await lookupBalances(wrapper, portfolioTokens)
        // expect(await wrapper.isBalanced()).to.equal(true)
    })


})

/*
function colorLog(message, defaultColor) {

    let color = defaultColor || "black";

    switch (color) {
        case "success":
            color = "Green";
            break;
        case "info":
            color = "DodgerBlue";
            break;
        case "error":
            color = "Red";
            break;
        case "warning":
            color = "Orange";
            break;
        default:
            color = defaultColor;
    }

    console.log("%c" + message, "color:" + color);
}
*/
