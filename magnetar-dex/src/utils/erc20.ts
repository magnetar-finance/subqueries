import { Erc20Abi__factory } from '../types/contracts';

export async function getERC20Metadata(address: string) {
  const erc20 = Erc20Abi__factory.connect(address, api);
  // Name
  const name = await erc20.name();
  const decimals = await erc20.decimals();
  const symbol = await erc20.symbol();
  return { decimals, symbol, name };
}

export async function getERC20Balance(address: string, account: string) {
  const erc20 = Erc20Abi__factory.connect(address, api);
  const balance = await erc20.balanceOf(account);
  return balance;
}
