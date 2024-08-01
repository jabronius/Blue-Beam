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
const CRONOS_EXPLORER_API_URL = 'https://api.cronos.org/api?module=contract&action=getabi&address=';

function getWeb3Instance(network) {
  if (network === 'testnet') {
    return new Web3(new Web3.providers.HttpProvider(config.tcronosRpcUrl));
  }
  return new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));
}

async function getCronosBalance(userId, network) {
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
    console.error('Error fetching Cronos balance:', error);
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
  // Placeholder implementation
  return [];
}

async function getTokenUSDValue(token, network) {
  // Placeholder for actual implementation to get USD value of a token
  // Replace with real API call if needed
  if (token === 'CRO' || token === 'tCRO') {
    return 0.1; // Example value, replace with actual
  }
  return 0;
}

async function displayHoldings(ctx, walletAddress, holdings, network) {
  const web3 = getWeb3Instance(network);
  const balanceWei = await web3.eth.getBalance(walletAddress);
  const balance = Number(web3.utils.fromWei(balanceWei, 'ether'));
  const valueUSD = balance * await getTokenUSDValue(network === 'testnet' ? 'tCRO' : 'CRO', network);

  holdings.push({
    token: network === 'testnet' ? 'tCRO' : 'CRO',
    balance: balance,
    valueUSD: valueUSD
  });

  if (holdings.length === 0) {
    await ctx.reply(`Wallet Address: ${walletAddress}\nYour token holdings: Currently no open positions.`, Markup.inlineKeyboard([
      Markup.button.callback('BUY', 'buy_token'),
      Markup.button.callback('Paste Token', 'paste_token')
    ]));
    return;
  }

  let message = `Wallet Address: ${walletAddress}\nYour token holdings on Cronos ${network}:\n`;
  for (const holding of holdings) {
    message += `Token Name: ${holding.token}\nAmount: ${holding.balance}\nValue (USD): ${holding.valueUSD}\n\n`;
  }

  await ctx.reply(message, Markup.inlineKeyboard([
    Markup.button.callback('BUY', 'buy_token'),
    Markup.button.callback('Paste Token', 'paste_token')
  ]));
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
      ctx.reply(`Enter the amount in ${ctx.session.network === 'testnet' ? 'tCRO' : 'CRO'} to purchase ${ctx.session.tokenInfo.tokenSymbol}:`);
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
  if (ctx.session) {
    if (ctx.session.expectingTokenAddress) {
      const tokenAddress = ctx.message.text.trim();
      const tokenInfo = await getTokenInfo(tokenAddress);
      if (tokenInfo) {
        ctx.session.tokenInfo = tokenInfo;
        const userBalance = await getCronosBalance(ctx.from.id, 'mainnet');
        await sendTokenInfo(ctx, tokenInfo, userBalance, 'mainnet');
      } else {
        ctx.reply('Failed to fetch token information. Please try again later.');
      }
      ctx.session.expectingTokenAddress = false;
    } else if (ctx.session.expectingBuyAmount) {
      const amountInCRO = parseFloat(ctx.message.text.trim());
      if (isNaN(amountInCRO) || amountInCRO <= 0) {
        ctx.reply('Invalid amount. Please enter a valid number.');
        return;
      }

      const userAddress = await getAddressByUserId(ctx.from.id);
      const privateKey = config.privateKey;

      try {
        const bestTrade = await getBestTrade(ctx.session.tokenInfo.tokenAddress, amountInCRO);
        if (!bestTrade) {
          ctx.reply('Failed to find a suitable trade. Please try again later.');
          return;
        }

        const txHash = await executeTrade(bestTrade, userAddress, privateKey);
        ctx.reply(`Successfully bought ${ctx.session.tokenInfo.tokenSymbol} on ${bestTrade.platform}. Transaction receipt: ${txHash}`);
      } catch (error) {
        ctx.reply('Failed to execute trade. Please try again later.');
      }

      ctx.session.expectingBuyAmount = false;
    }
  }
}

async function sendTokenInfo(ctx, tokenInfo, userBalance, network) {
  ctx.reply(
    `Token Information:\nName: ${tokenInfo.tokenName}\nSymbol: ${tokenInfo.tokenSymbol}\nCurrent Price (${network === 'testnet' ? 'tCRO' : 'CRO'}): ${tokenInfo.currentPriceCRO}\nCurrent Price (USD): ${tokenInfo.currentPriceUSD}\nMarket Cap: ${tokenInfo.marketCap}\nDexScreener URL: ${tokenInfo.url}\n\nYour ${network === 'testnet' ? 'tCRO' : 'CRO'} Balance: ${userBalance}`,
    Markup.inlineKeyboard([
      Markup.button.callback('BUY', 'buy_token'),
      Markup.button.callback('Open Positions', 'open_positions'),
      Markup.button.callback('Paste Token', 'paste_token')
    ])
  );
}

async function sendBalanceAndOptions(ctx, balance, network) {
  ctx.reply(`Cronos ${network === 'testnet' ? 'Testnet' : 'Mainnet'} Balance: ${balance} ${network === 'testnet' ? 'tCRO' : 'CRO'}`, Markup.inlineKeyboard([
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

  let message = `Wallet Address: ${walletAddress}\n\n`;
  
  message += `Your token holdings on Cronos Mainnet:\n`;
  for (const holding of mainnetHoldings) {
    message += `Token Name: ${holding.token}\nAmount: ${holding.balance}\nValue (USD): ${holding.valueUSD}\n\n`;
  }

  message += `Your token holdings on Cronos Testnet:\n`;
  for (const holding of testnetHoldings) {
    message += `Token Name: ${holding.token}\nAmount: ${holding.balance}\nValue (USD): ${holding.valueUSD}\n\n`;
  }

  await ctx.reply(message, Markup.inlineKeyboard([
    Markup.button.callback('BUY', 'buy_token'),
    Markup.button.callback('Paste Token', 'paste_token')
  ]));
}

export { handleStart, handleCallbackQuery, handleMessage, fetchTokenABI, getTokenInfo };
