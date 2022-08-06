export function initializeTestLogging(_this : any, _dirname : string) : number {
    const __root = _dirname.replace('/test', '')
    let filepathArray = (_this.test?.file)?.split('/') as string[]
    require('fs').writeFileSync(__root+'/.convincer/'+filepathArray[filepathArray.length-1]+"_", "")
    return 0 // to assign proofCounter on the same line
}

export function logTestComplete(_this : any, _dirname : string, proofCounter : number) {
    const __root = _dirname.replace('/test', '')
    const headFileCheck : string | undefined = require('fs').readFileSync(__root + '/.git/logs/HEAD').toString()
    let headFile = ''
    if (!headFileCheck) {
        console.error('lastGitCommit not available.')
        process.exit(1)
    }
    headFile = headFileCheck as string
    let headFileLines = headFile.replace('\r\n', '\n').split('\n')
    if (headFileLines[headFileLines.length-1] !== '') console.error('last line of git HEAD file is not empty.')
    let lastGitCommit = headFileLines[headFileLines.length-2].split(' ')[0]
    let filepathArray : string[] = (_this.file) ? _this.file.split('/') : (_this.test?.file)?.split('/')
    let testName : string = (_this.ctx.test) ? _this.ctx.test.title : _this.test?.title as string
    const proofArray = [
        proofCounter.toString(),
        filepathArray[filepathArray.length-1], // testFilename
        lastGitCommit,
        testName.replace(/ /g, '_')
    ]
    const testPassLog = proofArray.join('_')
    require('fs').appendFileSync(__root+'/.convincer/'+filepathArray[filepathArray.length-1]+"_", testPassLog + "\n")
}
