import { Component, ProviderMap } from '@loopback/core';
import { BindingKey } from '@loopback/core';
export declare namespace RChain {
    const RPUBLISHING: BindingKey<undefined>;
}
export declare class RChainComponent implements Component {
    constructor();
    providers?: ProviderMap;
}
