import { ORACLES } from '../constants';
import { Token } from '../types';
import { OracleAbi__factory } from '../types/contracts';
import { divideByBase, multiplyByBase } from './units';

export async function getTokenPrice(token: Token) {
  const oracleId = ORACLES[chainId];
  const oracle = OracleAbi__factory.connect(oracleId, api);
  const [ethValue] = await oracle.getAverageValueInETH(
    token.address,
    multiplyByBase(1, token.decimals),
  );
  const [usdValue] = await oracle.getAverageValueInUSD(
    token.address,
    multiplyByBase(1, token.decimals),
  );

  token.derivedETH = divideByBase(ethValue.toBigInt());
  token.derivedUSD = divideByBase(usdValue.toBigInt());

  await token.save();
  return token;
}
