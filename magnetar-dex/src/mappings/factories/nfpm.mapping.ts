import assert from 'assert';
import {
  DecreaseLiquidityLog,
  IncreaseLiquidityLog,
  TransferLog,
} from '../../types/abi-interfaces/NfpmAbi';
import { ZERO_ADDRESS, ZERO_NUM } from '../../constants';
import { LiquidityPosition, User } from '../../types';
import {
  deleteFromEphemeralHashMap,
  divideByBase,
  getValueFromEphemeralHashMap,
} from '../../utils';

export async function handleNFPMTransfer(log: TransferLog) {
  const params = log.args;

  assert(params, '!Params');

  const sender = params.from;
  const recipient = params.to;
  const isBurn = recipient === ZERO_ADDRESS;
  const isTransfer = recipient !== ZERO_ADDRESS && sender !== ZERO_ADDRESS;
  const isMint = sender === ZERO_ADDRESS;
  const tokenId = params.tokenId.toBigInt();

  let user = await User.get(recipient);

  if (!user) {
    user = User.create({
      id: recipient,
      address: recipient,
    });

    await user.save();
  }

  if (isMint) {
    const txHash = log.transaction.hash;
    const poolId = getValueFromEphemeralHashMap(txHash);
    const lpId = `${user.id}-${poolId}`;
    const lp = await LiquidityPosition.get(lpId);

    assert(lp, '!LP');

    // Remove from map
    deleteFromEphemeralHashMap(txHash);

    lp.accountId = user.id;
    lp.clPositionTokenId = tokenId;
    await lp.save();
  }

  if (isTransfer) {
    const [lp] = await LiquidityPosition.getByClPositionTokenId(tokenId, { limit: 1 });
    lp.accountId = user.id;
    await lp.save();
  }

  if (isBurn) {
    const [lp] = await LiquidityPosition.getByClPositionTokenId(tokenId, { limit: 1 });
    lp.accountId = undefined;
    lp.position = ZERO_NUM;
    await lp.save();
  }
}

export async function handleIncreaseLiquidity(log: IncreaseLiquidityLog) {
  const params = log.args;

  assert(params, '!Params');

  const tokenId = params.tokenId.toBigInt();
  const [lp] = await LiquidityPosition.getByClPositionTokenId(tokenId, { limit: 1 });
  const amount = divideByBase(params.liquidity.toBigInt());

  lp.position += amount;
  await lp.save();
}

export async function handleDecreaseLiquidity(log: DecreaseLiquidityLog) {
  const params = log.args;

  assert(params, '!Params');

  const tokenId = params.tokenId.toBigInt();
  const [lp] = await LiquidityPosition.getByClPositionTokenId(tokenId, { limit: 1 });
  const amount = divideByBase(params.liquidity.toBigInt());

  lp.position -= amount;
  await lp.save();
}
