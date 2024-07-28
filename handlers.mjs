import axios from 'axios';
import { Markup } from 'telegraf';
import Web3 from 'web3';
import { config } from './config.mjs';
import { initializeDatabase, getAddressByUserId } from './database.mjs';

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));
let db;

(async () => {
  db = await initializeDatabase();
})();

// API endpoint
const DEXS_CREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens/';

async function getCronosBalance(userId) {
  try {
    const address = await getAddressByUserId(userId);
    if (!address) {
      console.error('User address not found');
      return null; // Handle no address found
    }
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const data = response.data.pairs[0];
    
    if (!data) {
      console.error('Error: No data found for the token address');
      return null;
    }

    // Calculate age of token
    const pairCreatedAt = new Date(data.pairCreatedAt);
    const now = new Date();
    const ageInMilliseconds = now - pairCreatedAt;
    const ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
    const ageInMonths = Math.floor(ageInDays / 30);
    const remainingDays = ageInDays % 30;

    return {
      tokenName: data.baseToken.name,
      tokenSymbol: data.baseToken.symbol,
      currentPriceCRO: data.priceNative,
      currentPriceUSD: data.priceUsd,
      marketCap: data.fdv,
      ageOfToken: `${ageInMonths}mo ${remainingDays}d ago`,
      url: data.url
    };
  } catch (error) {
    console.error('Error fetching token information:', error.message);
    return null;
  }
}

async function fetchTokenHoldings(walletAddress) {
  // Implement your logic to fetch token holdings from the blockchain using web3
  // This is a placeholder function, you will need to adjust it to your specific needs
  try {
    return [
      { token: 'TokenA', balance: 100 },
      { token: 'TokenB', balance: 200 }
    ];
  } catch (error) {
    console.error('Error fetching token holdings:', error);
    return [];
  }
}

async function displayHoldings(ctx, holdings, walletAddress) {
  if (holdings.length === 0) {
    ctx.reply('No tokens found.');
    return;
  }

  let message = `Wallet Address: ${walletAddress}\nYour token holdings:\n`;
  for (const holding of holdings) {
    message += `${holding.token}: ${holding.balance}\n`;
  }

  ctx.reply(message);
}

async function handleStart(ctx) {
  await ctx.reply('Welcome to the Cronos Trading Bot! Please choose an option:',
    Markup.inlineKeyboard([
      Markup.button.callback('Create Wallet', 'create_wallet'),
      Markup.button.callback('Import Wallet', 'import_wallet'),
      Markup.button.callback('Paste Token', 'buy_token')  // Changed Buy Token to Paste Token
    ])
  );
}

async function handleCallbackQuery(ctx) {
  const action = ctx.callbackQuery.data;

  switch (action) {
    case 'create_wallet':
      const balance = await getCronosBalance(ctx.from.id);
      if (balance) {
        await sendBalanceAndOptions(ctx, balance);
      } else {
        ctx.reply("Failed to create wallet. Please try again.");
      }
      break;
    case 'import_wallet':
      // Assume importing wallet also checks balance
      const importedBalance = await getCronosBalance(ctx.from.id);
      await sendBalanceAndOptions(ctx, importedBalance);
      break;
    case 'buy_token':
      console.log("Session before setting expectingTokenAddress:", ctx.session);
      if (!ctx.session) {
        ctx.session = {}; // Ensure session object exists
      }
      ctx.session.expectingTokenAddress = true;
      ctx.reply('Please paste the Cronos token address.');
      break;
    case 'open_positions':
      const walletAddress = await getAddressByUserId(ctx.from.id);
      if (!walletAddress) {
        ctx.reply("No wallet found. Please create or import a wallet.");
        break;
      }
      const holdings = await fetchTokenHoldings(walletAddress);
      await displayHoldings(ctx, holdings, walletAddress);
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
  if (ctx.session && ctx.session.expectingTokenAddress) {
    const tokenAddress = ctx.message.text.trim();
    const tokenInfo = await getTokenInfo(tokenAddress);
    if (tokenInfo) {
      const userBalance = await getCronosBalance(ctx.from.id);
      await sendTokenInfo(ctx, tokenInfo, userBalance);
    } else {
      ctx.reply('Failed to fetch token information. Please try again later.');
    }
    ctx.session.expectingTokenAddress = false;
  }
}

async function sendTokenInfo(ctx, tokenInfo, userBalance) {
  ctx.reply(
    `Token Information:\nName: ${tokenInfo.tokenName}\nSymbol: ${tokenInfo.tokenSymbol}\nCurrent Price (CRO): ${tokenInfo.currentPriceCRO}\nCurrent Price (USD): ${tokenInfo.currentPriceUSD}\nMarket Cap: ${tokenInfo.marketCap}\nPair created ${tokenInfo.ageOfToken}\nDexScreener URL: ${tokenInfo.url}\n\nYour CRO Balance: ${userBalance}`,
    Markup.inlineKeyboard([
      Markup.button.callback('BUY', 'buy_token_action'), // New BUY button
      Markup.button.callback('Open Positions', 'open_positions'),
      Markup.button.callback('Paste Token', 'buy_token')  // Changed Buy Token to Paste Token
    ])
  );
}

async function sendBalanceAndOptions(ctx, balance) {
  const address = await getAddressByUserId(ctx.from.id);
  ctx.reply(`Wallet Address: ${address}\nCronos Balance: ${balance}`, Markup.inlineKeyboard([
    Markup.button.callback('Paste Token', 'buy_token'),  // Changed Buy Token to Paste Token
    Markup.button.callback('Open Positions', 'open_positions'),
    Markup.button.callback('Help', 'help'),
    Markup.button.callback('Settings', 'settings')
  ]));
}

export { handleStart, handleCallbackQuery, handleMessage };
