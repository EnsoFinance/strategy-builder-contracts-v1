"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkBytecode = exports.createLink = void 0;
function createLink(artifact, address) {
    return {
        sourceName: artifact.sourceName,
        libraryName: artifact.contractName,
        address: address
    };
}
exports.createLink = createLink;
function linkBytecode(artifact, libraries) {
    var bytecode = artifact.bytecode;
    // TODO: measure performance impact
    for (var _i = 0, libraries_1 = libraries; _i < libraries_1.length; _i++) {
        var _a = libraries_1[_i], sourceName = _a.sourceName, libraryName = _a.libraryName, address = _a.address;
        var linkReferences = artifact.linkReferences[sourceName][libraryName];
        for (var _b = 0, linkReferences_1 = linkReferences; _b < linkReferences_1.length; _b++) {
            var _c = linkReferences_1[_b], start = _c.start, length = _c.length;
            bytecode =
                bytecode.substr(0, 2 + start * 2) +
                    address.substr(2) +
                    bytecode.substr(2 + (start + length) * 2);
        }
    }
    artifact.bytecode = bytecode;
    return artifact;
}
exports.linkBytecode = linkBytecode;
