import assert from 'assert';
import { Burn, Mint, Pool, Statistics, Swap, Token, Transaction } from '../../types';
import { BurnLog, MintLog, SwapLog } from '../../types/abi-interfaces/V3PoolAbi';
import {
  createLPPosition,
  divideByBase,
  getTokenPrice,
  updateEphemeralHashmap,
  updateOverallDayData,
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
} from '../../utils';
import { ONE_BI, ZERO_BI, ZERO_NUM } from '../../constants';

export async function handleV3Swap(log: SwapLog): Promise<void> {
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

  // Balances before swap
  let reserve0 = pool.reserve0;
  let reserve1 = pool.reserve1;
  const isToken0Out = params.amount0.lt(ZERO_BI); // First token was sent out

  const amount0 = divideByBase(params.amount0.toBigInt(), token0.decimals);
  const amount1 = divideByBase(params.amount1.toBigInt(), token1.decimals);
  // Additions
  const amount0Total = amount0;
  const amount1Total = amount1;
  const amount0ETH = amount0Total * token0.derivedETH;
  const amount0USD = amount0Total * token0.derivedUSD;
  const amount1ETH = amount1Total * token1.derivedETH;
  const amount1USD = amount1Total * token1.derivedUSD;
  // After swap
  reserve0 = reserve0 + amount0;
  reserve1 = reserve1 + amount1;

  // Mutate pool
  const reserveETH = reserve0 * token0.derivedETH + reserve1 * token1.derivedETH;
  const reserveUSD = reserve0 * token0.derivedUSD + reserve1 * token1.derivedUSD;
  const amount0In = isToken0Out ? ZERO_NUM : amount0;
  const amount1In = isToken0Out ? amount1 : ZERO_NUM;
  const amount0Out = isToken0Out ? amount0 : ZERO_NUM;
  const amount1Out = isToken0Out ? ZERO_NUM : amount1;

  pool.volumeETH = pool.volumeETH + amount0ETH + amount1ETH;
  pool.volumeUSD = pool.volumeUSD + amount0USD + amount1USD;
  pool.volumeToken0 = pool.volumeToken0 + amount0;
  pool.volumeToken1 = pool.volumeToken1 + amount1;
  pool.txCount = pool.txCount + ONE_BI;
  pool.reserve0 = reserve0;
  pool.reserve1 = reserve1;
  pool.reserveETH = reserveETH;
  pool.reserveUSD = reserveUSD;

  if (pool.reserve1 !== ZERO_NUM) pool.token0Price = pool.reserve0 / pool.reserve1;
  else pool.token0Price = ZERO_NUM;

  if (pool.reserve0 !== ZERO_NUM) pool.token1Price = pool.reserve1 / pool.reserve0;
  else pool.token1Price = ZERO_NUM;

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

  const swapId = `swap-${transaction.id}`;
  const swap = Swap.create({
    id: swapId,
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    poolId: pool.id,
    sender: params.sender,
    from: log.transaction.from,
    to: params.recipient,
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

export async function handleV3Mint(log: MintLog): Promise<void> {
  const poolId = log.address;
  const pool = await Pool.get(poolId);
  const statistics = await Statistics.get('1');

  assert(pool, '!Pool');
  assert(statistics, '!Stats');

  const params = log.args;

  assert(params, '!Params');

  let token0 = await Token.get(pool.token0Id);
  let token1 = await Token.get(pool.token1Id);

  assert(token0 && token1, '!Token0 || !Token1');

  token0 = await getTokenPrice(token0);
  token1 = await getTokenPrice(token1);

  const amount0 = divideByBase(params.amount0.toBigInt(), token0.decimals);
  const amount1 = divideByBase(params.amount1.toBigInt(), token1.decimals);
  const liquidity = divideByBase(params.amount.toBigInt());
  const amount0USD = amount0 * token0.derivedUSD;
  const amount1USD = amount1 * token1.derivedUSD;

  token0.txCount = token0.txCount + ONE_BI;
  token0.totalLiquidity = token0.totalLiquidity + amount0;
  token0.totalLiquidityUSD = token0.totalLiquidityUSD + amount0USD;
  token0.totalLiquidityETH = token0.totalLiquidityETH + amount0 * token0.derivedETH;
  await token0.save();

  token1.txCount = token1.txCount + ONE_BI;
  token1.totalLiquidity = token1.totalLiquidity + amount1;
  token1.totalLiquidityUSD = token1.totalLiquidityUSD + amount1USD;
  token1.totalLiquidityETH = token1.totalLiquidityETH + amount1 * token1.derivedETH;
  await token1.save();

  statistics.txCount = statistics.txCount + ONE_BI;
  await statistics.save();

  pool.txCount = pool.txCount + ONE_BI;
  pool.reserve0 = pool.reserve0 + amount0;
  pool.reserve1 = pool.reserve1 + amount1;
  pool.reserveUSD = pool.reserveUSD + amount0USD + amount1USD;
  pool.reserveETH = pool.reserve0 * token0.derivedETH + pool.reserve1 * token1.derivedETH;
  pool.totalSupply = pool.totalSupply + liquidity;

  if (pool.reserve1 !== ZERO_NUM) pool.token0Price = pool.reserve0 * pool.reserve1;
  else pool.token0Price = ZERO_NUM;
  if (pool.reserve0 !== ZERO_NUM) pool.token1Price = pool.reserve1 * pool.reserve0;
  else pool.token1Price = ZERO_NUM;

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

  const mintId = `mint-${transaction.id}`;
  const mint = Mint.create({
    id: mintId,
    amount0,
    amount1,
    amountUSD: amount0USD + amount1USD,
    sender: params.sender,
    timestamp: log.block.timestamp,
    transactionId: transaction.id,
    poolId: pool.id,
    to: params.owner,
    liquidity,
  });

  await mint.save();

  // Map transaction ID to pool ID. We'll use this to determine the associated token ID later
  updateEphemeralHashmap(transaction.id, pool.id);
  // Create LP position
  await createLPPosition(log, params.owner, ZERO_BI);
}

export async function handleV3Burn(log: BurnLog): Promise<void> {
  const poolId = log.address;
  const pool = await Pool.get(poolId);
  const statistics = await Statistics.get('1');

  assert(pool, '!Pool');
  assert(statistics, '!Stats');

  const params = log.args;

  assert(params, '!Params');

  let token0 = await Token.get(pool.token0Id);
  let token1 = await Token.get(pool.token1Id);

  assert(token0 && token1, '!Token0 || !Token1');

  token0 = await getTokenPrice(token0);
  token1 = await getTokenPrice(token1);

  const amount0 = divideByBase(params.amount0.toBigInt(), token0.decimals);
  const amount1 = divideByBase(params.amount1.toBigInt(), token1.decimals);
  const liquidity = divideByBase(params.amount.toBigInt());

  token0.txCount = token0.txCount + ONE_BI;
  token0.totalLiquidity = token0.totalLiquidity - amount0;
  token0.totalLiquidityUSD = token0.totalLiquidityUSD - amount0 * token0.derivedUSD;
  token0.totalLiquidityETH = token0.totalLiquidityETH - amount0 * token0.derivedETH;

  token1.txCount = token1.txCount + ONE_BI;
  token1.totalLiquidity = token1.totalLiquidity - amount1;
  token1.totalLiquidityUSD = token1.totalLiquidityUSD - amount1 * token1.derivedUSD;
  token1.totalLiquidityETH = token1.totalLiquidityETH - amount1 * token1.derivedETH;

  const amount0USD = amount0 * token0.derivedUSD;
  const amount1USD = amount1 * token1.derivedUSD;
  const amountTotalUSD = amount0USD + amount1USD;
  const amount0ETH = amount0 * token0.derivedETH;
  const amount1ETH = amount1 * token1.derivedETH;
  const amountTotalETH = amount0ETH + amount1ETH;

  const reserve0 = pool.reserve0 - amount0;
  const reserve1 = pool.reserve1 - amount1;
  const reserveETH = pool.reserveETH - amountTotalETH;
  const reserveUSD = pool.reserveUSD - amountTotalUSD;
  const totalSupply = pool.totalSupply - liquidity;

  statistics.txCount = statistics.txCount + ONE_BI;
  statistics.totalVolumeLockedETH = statistics.totalVolumeLockedETH - amountTotalETH;
  statistics.totalVolumeLockedUSD = statistics.totalVolumeLockedUSD - amountTotalUSD;

  pool.txCount = pool.txCount + ONE_BI;
  pool.reserve0 = reserve0;
  pool.reserve1 = reserve1;
  pool.reserveETH = reserveETH;
  pool.reserveUSD = reserveUSD;
  pool.totalSupply = totalSupply;

  if (pool.reserve1 !== ZERO_NUM) pool.token0Price = pool.reserve0 * pool.reserve1;
  else pool.token0Price = ZERO_NUM;
  if (pool.reserve0 !== ZERO_NUM) pool.token1Price = pool.reserve1 * pool.reserve0;
  else pool.token1Price = ZERO_NUM;

  await token0.save();
  await token1.save();
  await statistics.save();
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

  const burnId = `burn-${transaction.id}`;
  const burn = Burn.create({
    id: burnId,
    transactionId: transaction.id,
    poolId: pool.id,
    liquidity,
    timestamp: transaction.timestamp,
    to: params.owner,
    needsComplete: true,
  });
  await burn.save();

  await updateOverallDayData(log);
  await updatePoolDayData(log);
  await updatePoolHourData(log);
  await updateTokenDayData(token0, log);
  await updateTokenDayData(token1, log);
}
