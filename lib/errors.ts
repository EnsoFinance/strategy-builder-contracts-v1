import errors from '../errors/errors.json'

interface ErrorCodes {}

interface ErrorData {
    contractId: string;
    contractName: string;
    errorcodes?: ErrorCodes;
}

function leftZeroPad(str: string, width: number) : string {
    while (str.length < width) {
        str = "0"+str
    }
    return str
}

export function readError(err : string) : string {
    let errNumber = 0
    try {
        errNumber = parseInt(err)
    } catch {
        return "readError: cannot parse as int."
    }
    err = errNumber.toString(16)
    err = leftZeroPad(err, 14)
    const firstSixBytes = err.substring(0,12)
    const errorContract = errors.find((ed: ErrorData) => ed.contractId === firstSixBytes)
    const keys = Object.keys(errorContract as any)
    const hasErrorcodes = keys.find((elt: string) => elt === "errorcodes")
    if (hasErrorcodes === "") return "readError: errorcodes not listed for contract."
    const errorcodes = errorContract?.errorcodes
    const errorKeys = Object.keys(errorcodes as any)
    const hasKey = errorKeys.find((elt: string) => elt === err)
    if (hasKey === "") return "readError: errorcode does not on file for the contract." 
    const anyErrorcodes = errorcodes as any
    return anyErrorcodes[err]
}

export function getErrorCodes(contractFileName: string, errMsg : string) : string[] {
    const errorContract = errors.find((ed: ErrorData) => ed.contractName === contractFileName)
    let keys = Object.keys(errorContract as any)
    const hasErrorcodes = keys.find((elt: string) => elt === "errorcodes")
    if (hasErrorcodes === "") return ["getErrorCode: errorcodes not listed for contract."]
    const errorcodes = errorContract?.errorcodes
    const anyErrorcodes = errorcodes as any
    keys = Object.keys(errorcodes as any) 
    const codes = keys.filter((k: string) => 
        anyErrorcodes[k] === errMsg
    )
    if (codes.length === 0) return ["getErrorCode: errorcode does not exist."]
    return codes
}

export function getErrorCodesAsRegExp(contractFileName: string, errMsg: string) : RegExp {
    const codes = getErrorCodes(contractFileName, errMsg)
    const joined = codes.join('\|')
    return new RegExp(joined)
}

// this was needed since for some reason chai was not allowing regexp for "revertedWith"
export async function isRevertedWith(p: Promise<any>, errMsg: string, contractFile: string) : Promise<boolean> {
    const errCodes = getErrorCodesAsRegExp(contractFile, errMsg)

    let isRevert = false
    let isInErrCodes = false
    try {
      await p
    } catch (e: any) {
        let err = e.toString()
        isRevert = err.includes("reverted with reason string")
        if (isRevert) {
            let revertString = err.replace(/.*reverted with reason string '/g, "")
            revertString = revertString.slice(0, -1) // trim last '
            isInErrCodes = errCodes.test(revertString)
        }
    }
    return isRevert && isInErrCodes
}

