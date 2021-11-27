import { Provider } from '@loopback/core';
interface Demo {
    masterRegistryUri: string;
    publisherPrivKey: string;
    attestorPrivKey: string;
    alicePrivKey: string;
    bobPrivKey: string;
}
export declare class RChainProvider implements Provider<Demo> {
    value(): Promise<Demo>;
}
export {};
