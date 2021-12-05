import { Artifact } from 'hardhat/types';
interface Link {
    sourceName: string;
    libraryName: string;
    address: string;
}
export declare function createLink(artifact: Artifact, address: string): Link;
export declare function linkBytecode(artifact: Artifact, libraries: Link[]): Artifact;
export {};
