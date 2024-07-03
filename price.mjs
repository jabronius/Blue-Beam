import fetch from 'node-fetch';
import Web3 from 'web3';
import { config } from './config.mjs';

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosNodeUrl));


export async function getPriceOfToken() {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=crypto-com-chain&vs_currencies=usd');
  const data = await response.json();
  return data['crypto-com-chain'].usd;
}

