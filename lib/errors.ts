import errors from '../errors/errors.json'

interface ErrorCodes {}

interface ErrorData {
    contractId: string;
    contractName: string;
    errorcodes?: ErrorCodes;
}

export function readError(err : string) : string {
    if (err.length != 14) return "readError: error wrong format." 
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
