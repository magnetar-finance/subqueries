import assert from 'assert';
import { Mint, Pool, Statistics, Swap, Token, Transaction } from '../../types';
import { MintLog, SwapLog, SyncLog } from '../../types/abi-interfaces/V2PoolAbi';
import {
  divideByBase,
  getTokenPrice,
  updateOverallDayData,
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
} from '../../utils';
import { ONE_BI, ZERO_ADDRESS, ZERO_BI, ZERO_NUM } from '../../constants';

export async function handleV2Swap(log: SwapLog): Promise<void> {
  const poolId = log.address;
  const pool = await Pool.get(poolId);

  assert(pool, '!Pool');

  let token0 = await Token.get(pool.token0Id);
  let token1 = await Token.get(pool.token1Id);

  assert(token0 && token1, '!Token0 || !Token1');

  // Load token prices
  token0 = await getTokenPrice(token0);
  token1 = await getTokenPrice(token1);

  const params = log.args;

  assert(params, '!Params');

  const amount0In = divideByBase(params.amount0In.toBigInt(), token0.decimals);
  const amount1In = divideByBase(params.amount1In.toBigInt(), token1.decimals);
  const amount0Out = divideByBase(params.amount0Out.toBigInt(), token0.decimals);
  const amount1Out = divideByBase(params.amount1Out.toBigInt(), token1.decimals);
  // Additions
  const amount0Total = amount0In + amount0Out;
  const amount1Total = amount1In + amount1Out;
  const amount0ETH = amount0Total * token0.derivedETH;
  const amount0USD = amount0Total * token0.derivedUSD;
  const amount1ETH = amount1Total * token1.derivedETH;
  const amount1USD = amount1Total * token1.derivedUSD;

  // Mutate pool
  pool.volumeETH = pool.volumeETH + amount0ETH + amount1ETH;
  pool.volumeUSD = pool.volumeUSD + amount0USD + amount1USD;
  pool.volumeToken0 = pool.volumeToken0 + amount0Total;
  pool.volumeToken1 = pool.volumeToken1 + amount1Total;
  pool.txCount = pool.txCount + ONE_BI;
  await pool.save();

  token0.tradeVolume = token0.tradeVolume + amount0Total;
  token0.tradeVolumeUSD = token0.tradeVolumeUSD + amount0USD;
  token0.txCount = token0.txCount + ONE_BI;
  await token0.save();

  token1.tradeVolume = token1.tradeVolume + amount1Total;
  token1.tradeVolumeUSD = token1.tradeVolumeUSD + amount1USD;
  token1.txCount = token1.txCount + ONE_BI;
  await token1.save();

  // Transaction
  const hash = log.transactionHash;
  let transaction = await Transaction.get(hash);

  if (!transaction) {
    transaction = Transaction.create({
      id: hash,
      block: BigInt(log.blockNumber),
      timestamp: log.block.timestamp,
      hash,
    });
    await transaction.save();
  }

  const swapId = transaction.id + ':' + log.logIndex.toString();
  const swap = Swap.create({
    id: swapId,
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: pool.id,
    sender: params.sender,
    from: log.transaction.from,
    to: params.to,
    amount0In,
    amount1In,
    amount0Out,
    amount1Out,
    amountUSD: amount0USD + amount1USD,
    logIndex: log.logIndex,
  });
  await swap.save();

  // Statistics
  const statistics = await Statistics.get('1');

  assert(statistics, '!Statistics');

  statistics.totalTradeVolumeUSD = statistics.totalTradeVolumeUSD + amount0USD + amount1USD;
  statistics.totalTradeVolumeETH = statistics.totalTradeVolumeETH + amount0ETH + amount1ETH;
  statistics.txCount = statistics.txCount + ONE_BI;
  await statistics.save();

  const overallDayData = await updateOverallDayData(log);
  const poolDayData = await updatePoolDayData(log);
  const poolHourData = await updatePoolHourData(log);
  const token0DayData = await updateTokenDayData(token0, log);
  const token1DayData = await updateTokenDayData(token1, log);

  overallDayData.feesUSD = overallDayData.feesUSD + pool.totalFeesUSD;
  overallDayData.volumeETH = overallDayData.volumeETH + amount0ETH + amount1ETH;
  overallDayData.volumeUSD = overallDayData.volumeUSD + amount0USD + amount1USD;
  await overallDayData.save();

  poolDayData.dailyVolumeToken0 = poolDayData.dailyVolumeToken0 + amount0Total;
  poolDayData.dailyVolumeToken1 = poolDayData.dailyVolumeToken1 + amount1Total;
  poolDayData.dailyVolumeETH = poolDayData.dailyVolumeETH + amount0ETH + amount1ETH;
  poolDayData.dailyVolumeUSD = poolDayData.dailyVolumeUSD + amount0USD + amount1USD;
  await poolDayData.save();

  poolHourData.hourlyVolumeToken0 = poolHourData.hourlyVolumeToken0 + amount0Total;
  poolHourData.hourlyVolumeToken1 = poolHourData.hourlyVolumeToken1 + amount1Total;
  poolHourData.hourlyVolumeETH = poolHourData.hourlyVolumeETH + amount0ETH + amount1ETH;
  poolHourData.hourlyVolumeUSD = poolHourData.hourlyVolumeUSD + amount0USD + amount1USD;
  await poolHourData.save();

  token0DayData.dailyVolumeToken = token0DayData.dailyVolumeToken + amount0Total;
  token0DayData.dailyVolumeUSD = token0DayData.dailyVolumeUSD + amount0USD;
  token0DayData.dailyVolumeETH = token0DayData.dailyVolumeETH + amount0ETH;
  await token0DayData.save();

  token1DayData.dailyVolumeToken = token1DayData.dailyVolumeToken + amount1Total;
  token1DayData.dailyVolumeUSD = token1DayData.dailyVolumeUSD + amount1USD;
  token1DayData.dailyVolumeETH = token1DayData.dailyVolumeETH + amount1ETH;
  await token1DayData.save();
}

export async function handleV2Mint(log: MintLog) {
  const pool = await Pool.get(log.address);
  assert(pool, '!Pool');

  let token0 = await Token.get(pool.token0Id);
  let token1 = await Token.get(pool.token1Id);

  assert(token0 && token1, '!Token0 || !Token1');

  // Load token prices
  token0 = await getTokenPrice(token0);
  token1 = await getTokenPrice(token1);

  const params = log.args;

  assert(params, '!Params');

  // Amounts
  const amount0 = divideByBase(params.amount0.toBigInt(), token0.decimals);
  const amount1 = divideByBase(params.amount1.toBigInt(), token1.decimals);
  const amount0USD = amount0 * token0.derivedUSD;
  const amount1USD = amount1 * token1.derivedUSD;
  const amount0ETH = amount0 * token0.derivedETH;
  const amount1ETH = amount1 * token1.derivedETH;

  token0.txCount = token0.txCount + ONE_BI;
  await token0.save();

  token1.txCount = token1.txCount + ONE_BI;
  await token1.save();

  // Statistics
  const statistics = await Statistics.get('1');

  assert(statistics, '!Statistics');

  statistics.txCount = statistics.txCount + ONE_BI;
  await statistics.save();

  pool.txCount = pool.txCount + ONE_BI;
  await pool.save();

  // Transaction
  const hash = log.transactionHash;
  let transaction = await Transaction.get(hash);

  if (!transaction) {
    transaction = Transaction.create({
      id: hash,
      block: BigInt(log.blockNumber),
      timestamp: log.block.timestamp,
      hash,
    });
    await transaction.save();
  }

  const mintId = transaction.id + '-' + log.logIndex;
  const mint = Mint.create({
    id: mintId,
    amount0,
    amount1,
    amountUSD: amount0USD + amount1USD,
    sender: params.sender,
    logIndex: log.logIndex,
    timestamp: ZERO_BI,
    transactionId: transaction.id,
    poolId: pool.id,
    to: ZERO_ADDRESS,
    liquidity: ZERO_NUM,
  });

  await mint.save();

  const overallDayData = await updateOverallDayData(log);
  const poolDayData = await updatePoolDayData(log);
  const poolHourData = await updatePoolHourData(log);
  const token0DayData = await updateTokenDayData(token0, log);
  const token1DayData = await updateTokenDayData(token1, log);

  overallDayData.feesUSD = overallDayData.feesUSD + pool.totalFeesUSD;
  overallDayData.volumeETH = overallDayData.volumeETH + amount0ETH + amount1ETH;
  overallDayData.volumeUSD = overallDayData.volumeUSD + amount0USD + amount1USD;
  await overallDayData.save();

  poolDayData.dailyVolumeToken0 = poolDayData.dailyVolumeToken0 + amount0;
  poolDayData.dailyVolumeToken1 = poolDayData.dailyVolumeToken1 + amount1;
  poolDayData.dailyVolumeETH = poolDayData.dailyVolumeETH + amount0ETH + amount1ETH;
  poolDayData.dailyVolumeUSD = poolDayData.dailyVolumeUSD + amount0USD + amount1USD;
  await poolDayData.save();

  poolHourData.hourlyVolumeToken0 = poolHourData.hourlyVolumeToken0 + amount0;
  poolHourData.hourlyVolumeToken1 = poolHourData.hourlyVolumeToken1 + amount1;
  poolHourData.hourlyVolumeETH = poolHourData.hourlyVolumeETH + amount0ETH + amount1ETH;
  poolHourData.hourlyVolumeUSD = poolHourData.hourlyVolumeUSD + amount0USD + amount1USD;
  await poolHourData.save();

  token0DayData.dailyVolumeToken = token0DayData.dailyVolumeToken + amount0;
  token0DayData.dailyVolumeUSD = token0DayData.dailyVolumeUSD + amount0USD;
  token0DayData.dailyVolumeETH = token0DayData.dailyVolumeETH + amount0ETH;
  await token0DayData.save();

  token1DayData.dailyVolumeToken = token1DayData.dailyVolumeToken + amount1;
  token1DayData.dailyVolumeUSD = token1DayData.dailyVolumeUSD + amount1USD;
  token1DayData.dailyVolumeETH = token1DayData.dailyVolumeETH + amount1ETH;
  await token1DayData.save();
}

export async function handleSync(log: SyncLog) {
  const pool = await Pool.get(log.address);
  assert(pool, '!Pool');

  // Statistics
  const statistics = await Statistics.get('1');

  assert(statistics, '!Statistics');

  let token0 = await Token.get(pool.token0Id);
  let token1 = await Token.get(pool.token1Id);

  assert(token0 && token1, '!Token0 || !Token1');

  const params = log.args;

  assert(params, '!Params');

  statistics.totalVolumeLockedETH = statistics.totalVolumeLockedETH - pool.reserveETH;

  token0.totalLiquidity = token0.totalLiquidity - pool.reserve0;
  token1.totalLiquidity = token1.totalLiquidity - pool.reserve1;

  pool.reserve0 = divideByBase(params.reserve0.toBigInt(), token0.decimals);
  pool.reserve1 = divideByBase(params.reserve1.toBigInt(), token1.decimals);

  if (pool.reserve1 !== ZERO_NUM) pool.token0Price = pool.reserve0 / pool.reserve1;
  else pool.token0Price = ZERO_NUM;

  if (pool.reserve0 !== ZERO_NUM) pool.token1Price = pool.reserve1 / pool.reserve0;
  else pool.token1Price = ZERO_NUM;

  // Load token prices
  token0 = await getTokenPrice(token0);
  token1 = await getTokenPrice(token1);

  pool.reserveETH = pool.reserve0 * token0.derivedETH + pool.reserve1 * token1.derivedETH;
  pool.reserveUSD = pool.reserve0 * token0.derivedUSD + pool.reserve1 * token1.derivedUSD;

  statistics.totalVolumeLockedETH = statistics.totalVolumeLockedETH + pool.reserveETH;
  statistics.totalVolumeLockedUSD = statistics.totalVolumeLockedUSD + pool.reserveUSD;

  token0.totalLiquidity = token0.totalLiquidity + pool.reserve0;
  token0.totalLiquidityETH = token0.totalLiquidity * token0.derivedETH;
  token0.totalLiquidityUSD = token0.totalLiquidity * token0.derivedUSD;

  token1.totalLiquidity = token1.totalLiquidity + pool.reserve1;
  token1.totalLiquidityETH = token1.totalLiquidity * token1.derivedETH;
  token1.totalLiquidityUSD = token1.totalLiquidity * token1.derivedUSD;

  await Promise.all([pool.save(), statistics.save(), token0.save(), token1.save()]);
}
