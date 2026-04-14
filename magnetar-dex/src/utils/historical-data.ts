import { EthereumLog } from '@subql/types-ethereum';
import {
  Gauge,
  GaugePosition,
  LiquidityPosition,
  OverallDayData,
  Pool,
  PoolDayData,
  PoolHourData,
  Statistics,
  Token,
  TokenDayData,
  User,
} from '../types';
import assert from 'assert';
import { ONE_BI, ZERO_BI, ZERO_NUM } from '../constants';
import { divideByBase } from './units';

export async function updateOverallDayData(log: EthereumLog) {
  const statistics = await Statistics.get('1');

  assert(statistics, '!Statistics');

  const timestamp = parseInt(log.block.timestamp.toString());
  const dayID = timestamp / 86400;
  const dayStartTimestamp = dayID * 86400;

  let overallDayData = await OverallDayData.get(dayID.toString());

  if (!overallDayData) {
    overallDayData = OverallDayData.create({
      id: dayID.toString(),
      feesUSD: ZERO_NUM,
      date: dayStartTimestamp,
      txCount: ZERO_BI,
      volumeETH: ZERO_NUM,
      volumeUSD: ZERO_NUM,
      liquidityETH: ZERO_NUM,
      liquidityUSD: ZERO_NUM,
      totalTradeVolumeETH: ZERO_NUM,
      totalTradeVolumeUSD: ZERO_NUM,
    });
  }

  overallDayData.liquidityUSD = statistics.totalVolumeLockedUSD;
  overallDayData.liquidityETH = statistics.totalVolumeLockedETH;
  overallDayData.totalTradeVolumeETH = statistics.totalTradeVolumeETH;
  overallDayData.totalTradeVolumeUSD = statistics.totalVolumeLockedUSD;
  overallDayData.txCount = overallDayData.txCount + ONE_BI;

  await overallDayData.save();

  return overallDayData;
}

export async function updatePoolDayData(log: EthereumLog) {
  const timestamp = parseInt(log.block.timestamp.toString());
  const dayID = timestamp / 86400;
  const dayStartTimestamp = dayID * 86400;
  const dayPoolID = log.address.concat('-').concat(dayID.toString());
  const pool = await Pool.get(log.address);

  assert(pool, '!Pool');

  let poolDayData = await PoolDayData.get(dayPoolID);

  if (!poolDayData) {
    poolDayData = PoolDayData.create({
      id: dayPoolID,
      date: dayStartTimestamp,
      dailyTxns: ZERO_BI,
      dailyVolumeETH: ZERO_NUM,
      dailyVolumeToken0: ZERO_NUM,
      dailyVolumeToken1: ZERO_NUM,
      dailyVolumeUSD: ZERO_NUM,
      poolId: pool.id,
      totalSupply: ZERO_NUM,
      reserve0: ZERO_NUM,
      reserve1: ZERO_NUM,
      reserveETH: ZERO_NUM,
      reserveUSD: ZERO_NUM,
    });
  }

  poolDayData.totalSupply = pool.totalSupply;
  poolDayData.reserve0 = pool.reserve0;
  poolDayData.reserve1 = pool.reserve1;
  poolDayData.reserveUSD = pool.reserveUSD;
  poolDayData.reserveETH = pool.reserveETH;
  poolDayData.dailyTxns = poolDayData.dailyTxns + ONE_BI;

  await poolDayData.save();

  return poolDayData;
}

export async function updatePoolHourData(log: EthereumLog) {
  const timestamp = parseInt(log.block.timestamp.toString());
  const hourIndex = timestamp / 3600;
  const hourStartUnix = hourIndex * 3600;
  const hourPoolID = log.address.concat('-').concat(hourIndex.toString());
  const pool = await Pool.get(log.address);

  assert(pool, '!Pool');

  let poolHourData = await PoolHourData.get(hourPoolID);

  if (!poolHourData) {
    poolHourData = PoolHourData.create({
      id: hourPoolID,
      hourStartUnix,
      poolId: pool.id,
      hourlyTxns: ZERO_BI,
      hourlyVolumeETH: ZERO_NUM,
      hourlyVolumeToken0: ZERO_NUM,
      hourlyVolumeToken1: ZERO_NUM,
      hourlyVolumeUSD: ZERO_NUM,
      totalSupply: ZERO_NUM,
      reserve0: ZERO_NUM,
      reserve1: ZERO_NUM,
      reserveETH: ZERO_NUM,
      reserveUSD: ZERO_NUM,
    });
  }

  poolHourData.totalSupply = pool.totalSupply;
  poolHourData.reserve0 = pool.reserve0;
  poolHourData.reserve1 = pool.reserve1;
  poolHourData.reserveUSD = pool.reserveUSD;
  poolHourData.reserveETH = pool.reserveETH;
  poolHourData.hourlyTxns = poolHourData.hourlyTxns + ONE_BI;

  await poolHourData.save();
  return poolHourData;
}

export async function updateTokenDayData(token: Token, log: EthereumLog) {
  const timestamp = parseInt(log.block.timestamp.toString());
  const dayID = timestamp / 86400;
  const dayStartTimestamp = dayID * 86400;
  const tokenDayID = token.id.concat('-').concat(dayID.toString());

  let tokenDayData = await TokenDayData.get(tokenDayID);

  if (!tokenDayData) {
    tokenDayData = TokenDayData.create({
      id: tokenDayID,
      date: dayStartTimestamp,
      tokenId: token.id,
      dailyTxns: ZERO_BI,
      dailyVolumeETH: ZERO_NUM,
      dailyVolumeToken: ZERO_NUM,
      dailyVolumeUSD: ZERO_NUM,
      priceUSD: ZERO_NUM,
      priceETH: ZERO_NUM,
      totalLiquidityETH: ZERO_NUM,
      totalLiquidityToken: ZERO_NUM,
      totalLiquidityUSD: ZERO_NUM,
    });
  }

  tokenDayData.priceUSD = token.derivedUSD;
  tokenDayData.priceETH = token.derivedETH;
  tokenDayData.totalLiquidityToken = token.totalLiquidity;
  tokenDayData.totalLiquidityETH = token.totalLiquidity * token.derivedETH;
  tokenDayData.totalLiquidityUSD = token.totalLiquidity * token.derivedUSD;
  tokenDayData.dailyTxns = tokenDayData.dailyTxns + ONE_BI;
  await tokenDayData.save();

  return tokenDayData;
}

export async function createLPPosition(
  log: EthereumLog,
  to: string,
  amount: bigint,
  tokenId?: bigint,
) {
  const poolId = log.address;
  const pool = await Pool.get(poolId);

  assert(pool, '!Pool');

  let user = await User.get(to);
  if (!user) {
    user = User.create({
      id: to,
      address: to,
    });

    await user.save();
  }

  const positionId = user.id.concat(`-${poolId}`);
  let position = await LiquidityPosition.get(positionId);

  if (!position) {
    position = LiquidityPosition.create({
      id: positionId,
      poolId,
      accountId: user.id,
      clPositionTokenId: tokenId,
      position: ZERO_NUM,
      creationBlock: BigInt(log.block.number),
      creationTransaction: log.transactionHash,
    });
  }

  position.position += divideByBase(amount);

  await position.save();
  return position;
}

export async function createGaugePosition(log: EthereumLog, to: string, amount: bigint) {
  const gaugeId = log.address;
  const gauge = await Gauge.get(gaugeId);

  assert(gauge, '!Gauge');

  let user = await User.get(to);
  if (!user) {
    user = User.create({
      id: to,
      address: to,
    });

    await user.save();
  }

  const positionId = user.id.concat(`-${gaugeId}`);
  let position = await GaugePosition.get(positionId);

  if (!position) {
    position = GaugePosition.create({
      id: positionId,
      gaugeId,
      accountId: user.id,
      amountDeposited: ZERO_NUM,
      creationBlock: BigInt(log.block.number),
      creationTransaction: log.transactionHash,
    });
  }

  position.amountDeposited += divideByBase(amount);

  await position.save();
  return position;
}
