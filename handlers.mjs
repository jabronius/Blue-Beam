import axios from 'axios';
import { Markup } from 'telegraf';
import Web3 from 'web3';
import { config } from './config.mjs';

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));

// API endpoint
const DEXS_CREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens/';

// Placeholder function to fetch balance from Cronos network
async function getCronosBalance(userId) {
  // Implement actual logic to get the balance based on userId
  return '1000'; // Replace with actual balance fetching logic
}

async function getTokenInfo(tokenAddress) {
  try {
    // Check if the address is valid
    if (!web3.utils.isAddress(tokenAddress)) {
      throw new Error('Invalid token address.');
    }

    // Fetch data from DexScreener
    const dexScreenerResponse = await axios.get(`${DEXS_CREENER_API_URL}${tokenAddress}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const dexScreenerData = dexScreenerResponse.data;
    console.log('DexScreener Data:', dexScreenerData); // Debugging

    if (!dexScreenerData || !dexScreenerData.pairs || dexScreenerData.pairs.length === 0) {
      throw new Error('Token information not found on DexScreener.');
    }

    const tokenInfo = dexScreenerData.pairs[0];

    return {
      tokenName: tokenInfo.baseToken.name || 'N/A',
      tokenSymbol: tokenInfo.baseToken.symbol || 'N/A',
      currentPriceCRO: tokenInfo.priceNative || 'N/A',
      currentPriceUSD: tokenInfo.priceUsd || 'N/A',
      marketCap: tokenInfo.fdv || 'N/A',
      ageOfToken: new Date(tokenInfo.pairCreatedAt).toLocaleDateString() || 'N/A',
      url: tokenInfo.url || 'N/A'
    };
  } catch (error) {
    console.error('Error fetching token information:', error.message);
    return null;
  }
}

async function handleStart(ctx) {
  ctx.reply('Welcome to the Cronos Trading Bot! Please choose an option:',
    Markup.inlineKeyboard([
      Markup.button.callback('Create Wallet', 'create_wallet'),
      Markup.button.callback('Import Wallet', 'import_wallet')
    ])
  );
}

async function handleCallbackQuery(ctx) {
  const action = ctx.callbackQuery.data;

  switch (action) {
    case 'create_wallet':
      await handleCreateWallet(ctx);
      break;
    case 'import_wallet':
      await handleImportWallet(ctx);
      break;
    case 'buy_token':
      ctx.reply('Please paste the Cronos token address.');
      ctx.session = ctx.session || {};  // Initialize session if it doesn't exist
      ctx.session.expectingTokenAddress = true;
      break;
    case 'open_positions':
      // Implement logic for open positions
      break;
    case 'help':
      // Implement help functionality
      break;
    case 'settings':
      // Implement settings functionality
      break;
    default:
      // Handle unknown action
      break;
  }
}

async function handleMessage(ctx) {
  if (ctx.session && ctx.session.expectingTokenAddress) {
    const tokenAddress = ctx.message.text.trim();
    console.log('Received Token Address:', tokenAddress); // Debugging

    const tokenInfo = await getTokenInfo(tokenAddress);

    if (tokenInfo) {
      ctx.reply(
        `Token Information:\n` +
        `Name: ${tokenInfo.tokenName}\n` +
        `Symbol: ${tokenInfo.tokenSymbol}\n` +
        `Current Price (CRO): ${tokenInfo.currentPriceCRO}\n` +
        `Current Price (USD): ${tokenInfo.currentPriceUSD}\n` +
        `Market Cap: ${tokenInfo.marketCap}\n` +
        `Age of Token: ${tokenInfo.ageOfToken}\n` +
        `DexScreener URL: ${tokenInfo.url}`
      );
    } else {
      ctx.reply('Failed to fetch token information. Please try again later.');
    }

    ctx.session.expectingTokenAddress = false;
  }
}

async function handleCreateWallet(ctx) {
  // Logic to create a new Cronos wallet and store securely
  // After successful creation, display balance and options
  const balance = await getCronosBalance(ctx.from.id);
  await sendBalanceAndOptions(ctx, balance);
}

async function handleImportWallet(ctx) {
  // Logic to import existing Cronos wallet using private key
  // After successful import, display balance and options
  const balance = await getCronosBalance(ctx.from.id);
  await sendBalanceAndOptions(ctx, balance);
}

async function sendBalanceAndOptions(ctx, balance) {
  ctx.reply(`Cronos Balance: ${balance}`, Markup.inlineKeyboard([
    Markup.button.callback('Buy Token', 'buy_token'),
    Markup.button.callback('Open Positions', 'open_positions'),
    Markup.button.callback('Help', 'help'),
    Markup.button.callback('Settings', 'settings')
  ]));
}

export { handleStart, handleCallbackQuery, handleMessage };
