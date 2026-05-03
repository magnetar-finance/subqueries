import { BigNumberish } from 'ethers';

export function divideByBase(a: string | number | bigint, base: number = 18): number {
  if (typeof a === 'bigint') a = parseFloat(a.toString());
  if (typeof a === 'string') a = parseFloat(a);
  const divisor = Math.pow(10, base);
  return a / divisor;
}

export function multiplyByBase(a: string | number, base: number = 18): BigNumberish {
  if (typeof a === 'string') a = parseFloat(a);
  const multiplier = Math.pow(10, base);
  return BigInt(a * multiplier);
}
