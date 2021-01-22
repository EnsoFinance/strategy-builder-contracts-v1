const { ethers } = require('hardhat')

module.exports = {
    // Sorts addresses according to token address byte value
    preparePortfolio(positions, router) {
        let portfolioTokens = []
        let portfolioPercentages = []
        let portfolioRouters = []
        positions.sort((a, b) => {
            const aNum = ethers.BigNumber.from(a.token)
            const bNum = ethers.BigNumber.from(b.token)
            return aNum.sub(bNum)
        }).forEach(position => {
            portfolioTokens.push(position.token)
            portfolioPercentages.push(position.percentage)
            portfolioRouters.push(router)
        })
        return [portfolioTokens, portfolioPercentages, portfolioRouters]
    }
}

