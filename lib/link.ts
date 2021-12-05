import { Artifact } from 'hardhat/types'

interface Link {
  sourceName: string;
  libraryName: string;
  address: string;
}

export function createLink(artifact: Artifact, address: string): Link {
    return {
      sourceName: artifact.sourceName,
      libraryName: artifact.contractName,
      address: address
    }
}

export function linkBytecode(artifact: Artifact, libraries: Link[]): Artifact {
  let bytecode = artifact.bytecode;

  // TODO: measure performance impact
  for (const { sourceName, libraryName, address } of libraries) {
    const linkReferences = artifact.linkReferences[sourceName][libraryName];
    for (const { start, length } of linkReferences) {
      bytecode =
        bytecode.substr(0, 2 + start * 2) +
        address.substr(2) +
        bytecode.substr(2 + (start + length) * 2);
    }
  }

  artifact.bytecode = bytecode;
  return artifact
}
