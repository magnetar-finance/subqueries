import {
  EthereumProject,
  EthereumDatasourceKind,
  EthereumHandlerKind,
} from '@subql/types-ethereum';

import * as dotenv from 'dotenv';
import path from 'path';

const mode = process.env.NODE_ENV || 'production';

// Load the appropriate .env file
const dotenvPath = path.resolve(__dirname, `.env${mode !== 'production' ? `.${mode}` : ''}`);
dotenv.config({ path: dotenvPath, quiet: true });

// Can expand the Datasource processor types via the generic param
const project: EthereumProject = {
  specVersion: '1.0.0',
  version: '0.0.1',
  name: 'ethereum-starter',
  description:
    'This project can be use as a starting point for developing your new Ethereum SubQuery project',
  runner: {
    node: {
      name: '@subql/node-ethereum',
      version: '>=3.0.0',
    },
    query: {
      name: '@subql/query',
      version: '*',
    },
  },
  schema: {
    file: './schema.graphql',
  },
  network: {
    /**
     * chainId is the EVM Chain ID, for Ethereum this is 1
     * https://chainlist.org/chain/1
     */
    chainId: process.env.CHAIN_ID!,
    /**
     * These endpoint(s) should be public non-pruned archive node
     * We recommend providing more than one endpoint for improved reliability, performance, and uptime
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * If you use a rate limited endpoint, adjust the --batch-size and --workers parameters
     * These settings can be found in your docker-compose.yaml, they will slow indexing but prevent your project being rate limited
     */
    endpoint: process.env.ENDPOINT!?.split(',') as string[] | string,
  },
  dataSources: [
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 19733040,
      options: {
        abi: 'v2-pool-factory',
        address: '0xf00EB8c6877d18B97C47013AfAc2049584c91bDb',
      },
      assets: new Map([
        ['v2-pool-factory', { file: './abis/v2-pool-factory.abi.json' }],
        ['erc20', { file: './abis/erc20.abi.json' }],
      ]),
      mapping: {
        file: './dist/index.js',
        handlers: [
          {
            handler: 'handleV2PoolCreated',
            kind: EthereumHandlerKind.Event,
            filter: {
              topics: ['PoolCreated(address,address,bool,address,uint256)'],
            },
          },
        ],
      },
    },
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 10349865,
      options: {
        abi: 'v3-pool-factory',
        address: '0xB15716c7404BceFaDbd211b04F10bCbD9F93f6Dc',
      },
      assets: new Map([
        ['v3-pool-factory', { file: './abis/v3-pool-factory.abi.json' }],
        ['erc20', { file: './abis/erc20.abi.json' }],
      ]),
      mapping: {
        file: './dist/index.js',
        handlers: [
          {
            handler: 'handleV3PoolCreated',
            kind: EthereumHandlerKind.Event,
            filter: {
              topics: ['PoolCreated(address,address,int24,address)'],
            },
          },
        ],
      },
    },
  ],
  templates: [
    {
      kind: EthereumDatasourceKind.Runtime,
      name: 'V2Pool',
      options: {
        abi: 'v2-pool',
      },
      assets: new Map([
        ['v2-pool', { file: './abis/v2-pool.abi.json' }],
        ['erc20', { file: './abis/erc20.abi.json' }],
        ['oracle', { file: './abis/oracle.abi.json' }],
      ]),
      mapping: {
        file: './dist/index.js',
        handlers: [
          {
            handler: 'handleV2Mint',
            kind: EthereumHandlerKind.Event,
            filter: {
              topics: ['Mint(address,uint256,uint256)'],
            },
          },
          {
            handler: 'handleV2Swap',
            kind: EthereumHandlerKind.Event,
            filter: {
              topics: ['Swap(address,address,uint256,uint256,uint256,uint256)'],
            },
          },
          {
            handler: 'handleSync',
            kind: EthereumHandlerKind.Event,
            filter: {
              topics: ['Sync(uint256,uint256)'],
            },
          },
          {
            handler: 'handleV2Burn',
            kind: EthereumHandlerKind.Event,
            filter: {
              topics: ['Burn(address,address,uint256,uint256)'],
            },
          },
          {
            handler: 'handleFees',
            kind: EthereumHandlerKind.Event,
            filter: {
              topics: ['Fees(address,uint256,uint256)'],
            },
          },
        ],
      },
    },
    {
      kind: EthereumDatasourceKind.Runtime,
      name: 'V3Pool',
      options: {
        abi: 'v3-pool',
      },
      assets: new Map([
        ['v3-pool', { file: './abis/v3-pool.abi.json' }],
        ['erc20', { file: './abis/erc20.abi.json' }],
        ['oracle', { file: './abis/oracle.abi.json' }],
      ]),
      mapping: {
        file: './dist/index.js',
        handlers: [
          {
            handler: 'handleV3Mint',
            kind: EthereumHandlerKind.Event,
            filter: {
              topics: ['Mint(address,address,int24,int24,uint128,uint256,uint256)'],
            },
          },
        ],
      },
    },
  ],
  repository: 'https://github.com/subquery/ethereum-subql-starter',
};

// Must set default to the project instance
export default project;
