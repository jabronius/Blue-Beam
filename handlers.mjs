import axios from 'axios';
import { Markup } from 'telegraf';
import Web3 from 'web3';
import bip39 from 'bip39';
import { initializeDatabase, getAddressByUserId, saveUserCronosAddress } from './database.mjs';
import { config } from './config.mjs';

import wallet from 'ethereumjs-wallet';
const { hdkey } = wallet;

let db;
(async () => {
  db = await initializeDatabase();
})();

const DEXS_CREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens/';
const EBISUS_BAY_API_URL = 'https://dexscreener.com/cronos?rankBy=trendingScoreH6&order=desc&dexIds=ebisus-bay&minLiq=1000';
const VVS_FINANCE_API_URL = 'https://dexscreener.com/cronos?rankBy=trendingScoreH6&order=desc&dexIds=vvsfinance&minLiq=1000';
const CRONOS_EXPLORER_API_URL = 'https://api.cronos.org/api?module=contract&action=getabi&address=';

function getWeb3Instance(network) {
  switch (network) {
    case 'testnet':
      return new Web3(new Web3.providers.HttpProvider(config.tcronosRpcUrl));
    case 'zkEVM':
      return new Web3(new Web3.providers.HttpProvider(config.zkCronosRpcUrl));
    default:
      return new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));
  }
}

async function getCronosBalance(userId, network, retries = 3) {
  try {
    const address = await getAddressByUserId(userId);
    if (!address) {
      console.error('User address not found');
      return null;
    }
    const web3 = getWeb3Instance(network);
    const balanceWei = await web3.eth.getBalance(address);
    return web3.utils.fromWei(balanceWei, 'ether');
  } catch (error) {
    console.error(`Error fetching Cronos balance (attempt ${4 - retries}):`, error);
    if (retries > 0) {
      return getCronosBalance(userId, network, retries - 1);
    }
    return null;
  }
}

async function getTokenInfo(tokenAddress) {
  try {
    const response = await axios.get(`${DEXS_CREENER_API_URL}${tokenAddress}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    const data = response.data;
    if (!data.pairs || data.pairs.length === 0) {
      throw new Error('No pairs found for the given token address');
    }
    const pair = data.pairs[0];

    return {
      tokenName: pair.baseToken.name,
      tokenSymbol: pair.baseToken.symbol,
      currentPriceCRO: pair.priceNative,
      currentPriceUSD: pair.priceUsd,
      marketCap: pair.fdv,
      priceChange: pair.priceChange,
      url: pair.url,
      tokenAddress: tokenAddress
    };
  } catch (error) {
    console.error('Error fetching token information:', error);
    return null;
  }
}

async function fetchTokenABI(tokenAddress) {
  try {
    const response = await axios.get(`${CRONOS_EXPLORER_API_URL}${tokenAddress}`);
    const abi = JSON.parse(response.data.result);
    return abi;
  } catch (error) {
    console.error('Error fetching token ABI:', error);
    return null;
  }
}

async function fetchTokenHoldings(walletAddress, network) {
  const web3 = getWeb3Instance(network);
  const balanceWei = await web3.eth.getBalance(walletAddress);
  const balance = parseFloat(web3.utils.fromWei(balanceWei, 'ether'));
  const valueUSD = balance * await getTokenUSDValue(network === 'testnet' ? 'tCRO' : (network === 'zkEVM' ? 'zkCRO' : 'CRO'), network);

  return [{
    token: network === 'testnet' ? 'tCRO' : (network === 'zkEVM' ? 'zkCRO' : 'CRO'),
    balance: balance,
    valueUSD: valueUSD
  }];
}

async function getTokenUSDValue(token, network) {
  // Placeholder for actual implementation to get USD value of a token
  // Replace with real API call if needed
  if (token === 'CRO' || token === 'tCRO' || token === 'zkCRO') {
    return 0.1; // Example value, replace with actual
  }
  return 0;
}

async function calculateProfitAndMetrics(tokenHoldings, tokenInfo) {
  if (!tokenInfo) {
    return null;
  }

  // Placeholder implementation for profit calculation
  const initialInvestmentCRO = 1; // Example initial investment in CRO
  const currentValueCRO = tokenHoldings.balance * tokenInfo.currentPriceCRO;
  const profitCRO = currentValueCRO - initialInvestmentCRO;
  const profitPercent = (profitCRO / initialInvestmentCRO) * 100;
  const valueUSD = tokenHoldings.valueUSD;
  const valueCRO = tokenHoldings.balance;
  const marketCap = tokenInfo.marketCap;
  const price = tokenInfo.currentPriceCRO;
  const priceChanges = tokenInfo.priceChange;

  return {
    profitPercent: profitPercent.toFixed(2),
    profitCRO: profitCRO.toFixed(4),
    valueUSD: valueUSD.toFixed(2),
    valueCRO: valueCRO.toFixed(4),
    marketCap: marketCap.toLocaleString(),
    price: price.toFixed(10),
    priceChanges: priceChanges
  };
}

async function fetchTopCoins(apiUrl, limit = 5) {
  try {
    const response = await axios.get(apiUrl);
    const coins = response.data.pairs.slice(0, limit).map(pair => ({
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      marketCap: pair.fdv
    }));
    return coins;
  } catch (error) {
    console.error('Error fetching top coins:', error);
    return [];
  }
}

async function fetchLatestPairs() {
  try {
    const response = await axios.get(`${DEXS_CREENER_API_URL}new-pairs`);
    return response.data.pairs.slice(0, 5);
  } catch (error) {
    console.error('Error fetching latest pairs:', error);
    return [];
  }
}

async function handleStart(ctx) {
  await ctx.reply('Welcome to the Cronos Trading Bot! Please choose an option:',
    Markup.inlineKeyboard([
      Markup.button.callback('Create Wallet', 'create_wallet'),
      Markup.button.callback('Import Wallet', 'import_wallet'),
      Markup.button.callback('Paste Token', 'paste_token')
    ])
  );
}

async function handleCallbackQuery(ctx) {
  const action = ctx.callbackQuery.data;

  switch (action) {
    case 'create_wallet':
      const mnemonic = bip39.generateMnemonic();
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const hdWallet = hdkey.fromMasterSeed(seed);
      const key = hdWallet.derivePath("m/44'/60'/0'/0/0");
      const wallet = key.getWallet();
      const address = wallet.getChecksumAddressString();
      await saveUserCronosAddress(ctx.from.id, address, mnemonic);
      const balance = await getCronosBalance(ctx.from.id, 'mainnet');
      await ctx.reply(`Wallet created! Address: ${address}`);
      if (balance) {
        await sendBalanceAndOptions(ctx, balance, 'mainnet');
      } else {
        ctx.reply("Failed to create wallet. Please try again.");
      }
      break;
    case 'import_wallet':
      const importedBalance = await getCronosBalance(ctx.from.id, 'mainnet');
      await sendBalanceAndOptions(ctx, importedBalance, 'mainnet');
      break;
    case 'paste_token':
      if (!ctx.session) {
        ctx.session = {};
      }
      ctx.session.expectingTokenAddress = true;
      ctx.reply('Please paste the Cronos token address.');
      break;
    case 'buy_token':
      if (!ctx.session || !ctx.session.tokenInfo) {
        ctx.reply('Please paste a token address first.');
        break;
      }
      ctx.session.expectingBuyAmount = true;
      ctx.reply(`Enter the amount in ${ctx.session.network === 'testnet' ? 'tCRO' : (ctx.session.network === 'zkEVM' ? 'zkCRO' : 'CRO')} to purchase ${ctx.session.tokenInfo.tokenSymbol}:`);
      break;
    case 'open_positions':
      await displayCombinedHoldings(ctx);
      break;
    case 'help':
      ctx.reply('How can I assist you?');
      break;
    case 'settings':
      ctx.reply('Settings options will be here.');
      break;
    default:
      ctx.reply('Unknown command.');
      break;
  }
}

async function handleMessage(ctx) {
  const text = ctx.message.text.trim().toLowerCase();
  switch (text) {
    case '/home':
      await ctx.reply('Choose an option:',
        Markup.inlineKeyboard([
          [Markup.button.callback('Create Wallet', 'create_wallet'), Markup.button.callback('Import Wallet', 'import_wallet')],
          [Markup.button.callback('Paste Token', 'paste_token'), Markup.button.callback('Open Positions', 'open_positions')],
          [Markup.button.callback('Help', 'help'), Markup.button.callback('Settings', 'settings')]
        ])
      );
      break;
    case '/token':
      if (!ctx.session) {
        ctx.session = {};
      }
      ctx.session.expectingTokenAddress = true;
      ctx.reply('Please paste the Cronos token address.');
      break;
    case '/ebisus':
      const ebisusTopCoins = await fetchTopCoins(EBISUS_BAY_API_URL);
      let ebisusMessage = 'Top 5 paired Cronos coins on Ebisus Bay DEX:\n\n';
      ebisusTopCoins.forEach((coin, index) => {
        ebisusMessage += `${index + 1}. ${coin.name} (${coin.symbol}) - ${coin.marketCap.toLocaleString()} Market Cap\n`;
      });
      await ctx.reply(ebisusMessage);
      break;
    case '/vvs':
      const vvsTopCoins = await fetchTopCoins(VVS_FINANCE_API_URL);
      let vvsMessage = 'Top 5 paired Cronos coins on VVS Finance DEX:\n\n';
      vvsTopCoins.forEach((coin, index) => {
        vvsMessage += `${index + 1}. ${coin.name} (${coin.symbol}) - ${coin.marketCap.toLocaleString()} Market Cap\n`;
      });
      await ctx.reply(vvsMessage);
      break;
    case '/new':
      const latestPairs = await fetchLatestPairs();
      let latestPairsMessage = 'Latest 5 Cronos pairs from Dex Screener:\n\n';
      latestPairs.forEach((pair, index) => {
        latestPairsMessage += `${index + 1}. ${pair.baseToken.name} (${pair.baseToken.symbol}) / ${pair.quoteToken.name} (${pair.quoteToken.symbol}) - Pair URL: ${pair.pairUrl}\n`;
      });
      await ctx.reply(latestPairsMessage);
      break;
    default:
      ctx.reply('Unknown command. Please use one of the available commands.');
      break;
  }
}

async function sendTokenInfo(ctx, tokenInfo, userBalance, network) {
  ctx.reply(
    `Token Information:\nName: ${tokenInfo.tokenName}\nSymbol: ${tokenInfo.tokenSymbol}\nCurrent Price (${network === 'testnet' ? 'tCRO' : (network === 'zkEVM' ? 'zkCRO' : 'CRO')}): ${tokenInfo.currentPriceCRO}\nCurrent Price (USD): ${tokenInfo.currentPriceUSD}\nMarket Cap: ${tokenInfo.marketCap}\nDexScreener URL: ${tokenInfo.url}\n\nYour ${network === 'testnet' ? 'tCRO' : (network === 'zkEVM' ? 'zkCRO' : 'CRO')} Balance: ${userBalance}`,
    Markup.inlineKeyboard([
      Markup.button.callback('BUY', 'buy_token'),
      Markup.button.callback('Open Positions', 'open_positions'),
      Markup.button.callback('Paste Token', 'paste_token')
    ])
  );
}

async function sendBalanceAndOptions(ctx, balance, network) {
  ctx.reply(`Cronos ${network === 'testnet' ? 'Testnet' : (network === 'zkEVM' ? 'zkEVM' : 'Mainnet')} Balance: ${balance} ${network === 'testnet' ? 'tCRO' : (network === 'zkEVM' ? 'zkCRO' : 'CRO')}`, Markup.inlineKeyboard([
    Markup.button.callback('Paste Token', 'paste_token'),
    Markup.button.callback('Open Positions', 'open_positions'),
    Markup.button.callback('Help', 'help'),
    Markup.button.callback('Settings', 'settings')
  ]));
}

async function displayCombinedHoldings(ctx) {
  const walletAddress = await getAddressByUserId(ctx.from.id);
  if (!walletAddress) {
    ctx.reply("No wallet found. Please create or import a wallet.");
    return;
  }

  const mainnetHoldings = await fetchTokenHoldings(walletAddress, 'mainnet');
  const testnetHoldings = await fetchTokenHoldings(walletAddress, 'testnet');
  const zkEvmHoldings = await fetchTokenHoldings(walletAddress, 'zkEVM');

  let message = `Wallet Address: ${walletAddress}\n\nPositions Overview: (Cronos Mainnet)\n\n`;

  for (const [index, holding] of mainnetHoldings.entries()) {
    const tokenInfo = await getTokenInfo(holding.token);
    if (!tokenInfo) {
      message += `/${index + 1} Token Info Unavailable\n\n`;
      continue;
    }

    const metrics = await calculateProfitAndMetrics(holding, tokenInfo);
    if (!metrics) {
      message += `/${index + 1} Metrics Calculation Failed\n\n`;
      continue;
    }

    message += `/${index + 1} ${tokenInfo.tokenName}\n`;
    message += `Profit: ${metrics.profitPercent}% / ${metrics.profitCRO} CRO\n`;
    message += `Value: $${metrics.valueUSD} / ${metrics.valueCRO} CRO\n`;
    message += `Mcap: $${metrics.marketCap} @ $${metrics.price}\n`;
    message += `5m: ${metrics.priceChanges.m5}%, 1h: ${metrics.priceChanges.h1}%, 6h: ${metrics.priceChanges.h6}%, 24h: ${metrics.priceChanges.h24}%\n\n`;
  }

  let totalBalance = mainnetHoldings.reduce((sum, holding) => sum + holding.balance, 0) +
                       testnetHoldings.reduce((sum, holding) => sum + holding.balance, 0) +
                       zkEvmHoldings.reduce((sum, holding) => sum + holding.balance, 0);

  let totalValueUSD = mainnetHoldings.reduce((sum, holding) => sum + holding.valueUSD, 0) +
                        testnetHoldings.reduce((sum, holding) => sum + holding.valueUSD, 0) +
                        zkEvmHoldings.reduce((sum, holding) => sum + holding.valueUSD, 0);

  totalBalance = totalBalance.toFixed(4);
  totalValueUSD = totalValueUSD.toFixed(2);

  message += `Balance: ${mainnetHoldings[0]?.balance || 0} CRO\n`;
  message += `Net Worth: ${totalBalance} CRO / $${totalValueUSD}\n`;

  await ctx.reply(message, Markup.inlineKeyboard([
    Markup.button.callback('BUY', 'buy_token'),
    Markup.button.callback('Paste Token', 'paste_token')
  ]));
}

export { handleStart, handleCallbackQuery, handleMessage, fetchTokenABI, getTokenInfo };
