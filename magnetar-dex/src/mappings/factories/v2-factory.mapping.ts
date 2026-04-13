// SPDX-License-Identifier: Apache-2.0

// Auto-generated

import assert from 'assert';
import { PoolCreatedLog } from '../../types/abi-interfaces/V2PoolFactoryAbi';
import { createV2PoolDatasource, Pool, PoolType, Statistics, Token } from '../../types';
import { getERC20Metadata } from '../../utils';
import { ONE_BI, ZERO_BI, ZERO_NUM } from '../../constants';

export async function handleV2PoolCreated(log: PoolCreatedLog): Promise<void> {
  assert(log.args, '!log.args');
  // Destructure args
  const { pool, token0, token1, stable } = log.args;

  let token0Entity = await Token.get(token0);
  let token1Entity = await Token.get(token1);

  if (!token0Entity) {
    const { name, symbol, decimals } = await getERC20Metadata(token0);

    token0Entity = Token.create({
      name,
      symbol,
      decimals,
      address: token0,
      id: token0,
      tradeVolume: ZERO_NUM,
      tradeVolumeUSD: ZERO_NUM,
      txCount: ZERO_BI,
      totalLiquidity: ZERO_NUM,
      totalLiquidityETH: ZERO_NUM,
      totalLiquidityUSD: ZERO_NUM,
      derivedETH: ZERO_NUM,
      derivedUSD: ZERO_NUM,
    });

    await token0Entity.save();
  }

  if (!token1Entity) {
    const { name, symbol, decimals } = await getERC20Metadata(token1);

    token1Entity = Token.create({
      name,
      symbol,
      decimals,
      address: token1,
      id: token1,
      tradeVolume: ZERO_NUM,
      tradeVolumeUSD: ZERO_NUM,
      txCount: ZERO_BI,
      totalLiquidity: ZERO_NUM,
      totalLiquidityETH: ZERO_NUM,
      totalLiquidityUSD: ZERO_NUM,
      derivedETH: ZERO_NUM,
      derivedUSD: ZERO_NUM,
    });

    await token1Entity.save();
  }

  // Create pool
  const { name } = await getERC20Metadata(pool);
  const poolEntity = Pool.create({
    id: pool,
    name,
    txCount: ZERO_BI,
    poolType: stable ? PoolType.STABLE : PoolType.VOLATILE,
    address: pool,
    token0Id: token0Entity.id,
    token1Id: token1Entity.id,
    reserve0: ZERO_NUM,
    reserve1: ZERO_NUM,
    reserveETH: ZERO_NUM,
    reserveUSD: ZERO_NUM,
    token0Price: ZERO_NUM,
    token1Price: ZERO_NUM,
    totalSupply: ZERO_NUM,
    volumeETH: ZERO_NUM,
    volumeToken0: ZERO_NUM,
    volumeToken1: ZERO_NUM,
    volumeUSD: ZERO_NUM,
    totalVotes: ZERO_NUM,
    createdAtBlockNumber: BigInt(log.blockNumber),
    createdAtTimestamp: log.block.timestamp,
    totalFeesUSD: ZERO_NUM,
    totalBribesUSD: ZERO_NUM,
    totalFees0: ZERO_NUM,
    totalFees1: ZERO_NUM,
    gaugeFeesUSD: ZERO_NUM,
    gaugeFees0CurrentEpoch: ZERO_NUM,
    gaugeFees1CurrentEpoch: ZERO_NUM,
    totalEmissions: ZERO_NUM,
    totalEmissionsUSD: ZERO_NUM,
  });

  await poolEntity.save();

  // Statistics
  const statsId = '1';
  let statistics = await Statistics.get(statsId);

  if (!statistics) {
    statistics = Statistics.create({
      id: statsId,
      txCount: ZERO_BI,
      totalBribesUSD: ZERO_NUM,
      totalFeesUSD: ZERO_NUM,
      totalPairsCreated: ZERO_BI,
      totalTradeVolumeETH: ZERO_NUM,
      totalTradeVolumeUSD: ZERO_NUM,
      totalVolumeLockedETH: ZERO_NUM,
      totalVolumeLockedUSD: ZERO_NUM,
    });
  }

  statistics.totalPairsCreated += ONE_BI;
  await statistics.save();

  await createV2PoolDatasource({ address: pool });
}
