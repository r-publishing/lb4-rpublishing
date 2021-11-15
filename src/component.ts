import {Component, ProviderMap} from '@loopback/core';
import { RChainProvider } from './providers/rchain';
import {BindingKey} from '@loopback/core';

export namespace RChain {
  export const RPUBLISHING = BindingKey.create<undefined>(
    'rchain.rpublishing',
  );
}

export class RChainComponent implements Component {
  constructor() {}

  providers?: ProviderMap = {
    [RChain.RPUBLISHING
        .key]: RChainProvider,
  };
}