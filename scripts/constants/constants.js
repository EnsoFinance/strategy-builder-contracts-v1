const wallets = [
  "1f067970231765da9b8d9e0744ca14bd0f4272646ab34f6115cd8453af0ba28d",
  "b0fe86c0ff2e8b77be204d8c205ad1830d81603c469ac177ba1e8b358196e2ba",
  "3cc572d8da946d778583498495d0f26ff232b18fd71328d77fdabfca2a4753ad",
  "b71781b231dc7026004eb8c0754013c366dacf671424b574a3ac2441b45964b9",
  "b81eae6995da9420956fb27e53813e3760a4855d64f89cc523dff32476e31626",
  "0d98d1e69ad2a07c9ab55f5cd19a47406440d42c1816c127cac61c8e9e411c8d",
  "1bc6e32873900d8747606ba2e96186e124b2f1f6f3ea0819b6677a99644b1463",
]

const strategyNames = [
  "AMM's",
  "Derivatives",
  "Options",
  "Defi ++",
  "Top MarketCaps",
  "NFT's",
  "Marbles",
  "Indexes",
  "Eternity",
  "Asimov",
  "LP Tokens",
  "Foundation",
  "Degen Index",
  "Best pies",
  "(〜￣▽￣) Kawaii Tokens",
  "Enso Best's",
  "Eternity",
  "🚀 Test in Prod 🚀",
  "✨ NFT's Markets✨",
  "💰 Stable Dollars 💰",
  "YFI Ecosystem",
  "🍣 Sushi LP's 🍣",
  "(ಠ ʖ̯ ಠ) Look here",
]

const positions = [
  [
    { token: "0x23d43C11781AFc0a298B97afde8b0901d0D971f4", percentage: 250 },
    { token: "0x97E4Cf3049103068a76CA1BA96Fc050765E60928", percentage: 750 },
  ],
  [
    { token: "0x97E4Cf3049103068a76CA1BA96Fc050765E60928", percentage: 500 },
    { token: "0x23d43C11781AFc0a298B97afde8b0901d0D971f4", percentage: 500 },
  ],
  [
    { token: "0x8c9f63b93c687B392C5f4257035e9124587F775C", percentage: 200 },
    { token: "0xd7401e6fac48ec803f65c38145c0512fe3cee8bf", percentage: 400 },
    { token: "0x3DF2B94DEE1fB1c8f2B0768A1E32304d2468E0f9", percentage: 400 },
  ],
  [
    { token: "0x97E4Cf3049103068a76CA1BA96Fc050765E60928", percentage: 250 },
    { token: "0x138109923878F778EE00785a65BAe796E2035274", percentage: 250 },
    { token: "0x26FEb91146F8054b20471BE52E9eb11C0333e26C", percentage: 250 },
    { token: "0xbf356737B091CCE6Ae5165A072f7a1f7e4c5c230", percentage: 250 },
  ],
  [
    { token: "0x3882F0F5a30e5B5472bdaEbFa3173f3A5FfdBc6D", percentage: 100 },
    { token: "0x26FEb91146F8054b20471BE52E9eb11C0333e26C", percentage: 100 },
    { token: "0x7FE3Cf5bB2417B19611Ecd76C5FbBbF14791437E", percentage: 150 },
    { token: "0x574c10B80f3D7Aa8dd3aD30fD680aDF00FA0C353", percentage: 200 },
    { token: "0x3ba7bF5e9fedBf17B039de1fe0c2898B92Ae0888", percentage: 450 },
  ],
  [
    { token: "0xD4CE93Ea44d5E9ACAe5BC1F788a5D902a52De887", percentage: 50 },
    { token: "0x23d43C11781AFc0a298B97afde8b0901d0D971f4", percentage: 50 },
    { token: "0x7FE3Cf5bB2417B19611Ecd76C5FbBbF14791437E", percentage: 100 },
    { token: "0x3DF2B94DEE1fB1c8f2B0768A1E32304d2468E0f9", percentage: 100 },
    { token: "0x574c10B80f3D7Aa8dd3aD30fD680aDF00FA0C353", percentage: 200 },
    { token: "0x26FEb91146F8054b20471BE52E9eb11C0333e26C", percentage: 200 },
    { token: "0x3ba7bF5e9fedBf17B039de1fe0c2898B92Ae0888", percentage: 300 },
  ],
]

module.exports = {
  strategyNames,
  wallets,
  positions,
}
