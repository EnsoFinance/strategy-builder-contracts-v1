import hre from "hardhat"
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export async function impersonateWithEth(addr: string, value: BigNumber): Promise<SignerWithAddress> {
    await hre.network.provider.send("hardhat_setBalance", [addr, value._hex]);
    const signer = await impersonateAccount(addr);
    return signer;
}

export async function impersonateAccount(addr: string): Promise<SignerWithAddress> {
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [addr],
    });
    const signerWithAddress = await hre.ethers.getSigner(addr);
    return signerWithAddress;
}
