import assert from 'assert';
import { Pool, Statistics, Swap, Token, Transaction } from '../../types';
import { SwapLog } from '../../types/abi-interfaces/V2PoolAbi';
import { divideByBase, getTokenPrice } from '../../utils';
import { ONE_BI } from '../../constants';

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
}
