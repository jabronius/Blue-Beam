import axios from 'axios';
import { Markup } from 'telegraf';
import Web3 from 'web3';
import { config } from './config.mjs';
import { initializeDatabase, getAddressByUserId, saveUserCronosAddress } from './database.mjs';

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));
let db;

(async () => {
  db = await initializeDatabase();
})();

// API endpoints
const DEXS_CREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens/';
const CRONOS_EXPLORER_API_URL = 'https://api.cronos.org/api?module=contract&action=getabi&address=';

async function getCronosBalance(userId) {
  try {
    const address = await getAddressByUserId(userId);
    if (!address) {
      console.error('User address not found');
      return null;
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

async function fetchTokenHoldings(walletAddress) {
  // Implement your logic to fetch token holdings from the blockchain using web3
  // Placeholder function, you need to adjust it to your specific needs
  return [];
}

async function displayHoldings(ctx, walletAddress, holdings) {
  if (holdings.length === 0) {
    await ctx.reply(`Wallet Address: ${walletAddress}\nYour token holdings: Currently no open positions.`, Markup.inlineKeyboard([
      Markup.button.callback('BUY', 'buy_token'),
      Markup.button.callback('Paste Token', 'paste_token')
    ]));
    return;
  }

  let message = `Wallet Address: ${walletAddress}\nYour token holdings:\n`;
  for (const holding of holdings) {
    const tokenInfo = await getTokenInfo(holding.token);
    if (tokenInfo) {
      const valueUSD = holding.balance * tokenInfo.currentPriceUSD;
      const valueCRO = holding.balance * tokenInfo.currentPriceCRO;
      message += `Token Name: ${tokenInfo.tokenName}\nSymbol: ${tokenInfo.tokenSymbol}\nAmount: ${holding.balance}\nValue (USD): ${valueUSD}\nValue (CRO): ${valueCRO}\n\n`;
    } else {
      message += `${holding.token}: ${holding.balance}\n`;
    }
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
      const balance = await getCronosBalance(ctx.from.id);
      if (balance) {
        await sendBalanceAndOptions(ctx, balance);
      } else {
        ctx.reply("Failed to create wallet. Please try again.");
      }
      break;
    case 'import_wallet':
      const importedBalance = await getCronosBalance(ctx.from.id);
      await sendBalanceAndOptions(ctx, importedBalance);
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
      ctx.reply(`Enter the amount in CRO to purchase ${ctx.session.tokenInfo.tokenSymbol}:`);
      break;
    case 'open_positions':
      const walletAddress = await getAddressByUserId(ctx.from.id);
      if (!walletAddress) {
        ctx.reply("No wallet found. Please create or import a wallet.");
        break;
      }
      const holdings = await fetchTokenHoldings(walletAddress);
      await displayHoldings(ctx, walletAddress, holdings);
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
        const userBalance = await getCronosBalance(ctx.from.id);
        await sendTokenInfo(ctx, tokenInfo, userBalance);
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

      const tokenAddress = ctx.session.tokenInfo.tokenAddress;
      const abi = await fetchTokenABI(tokenAddress);
      if (!abi) {
        ctx.reply('Failed to fetch token ABI. Please try again later.');
        return;
      }
      const tokenContract = new web3.eth.Contract(abi, tokenAddress);

      try {
        const tx = {
          from: userAddress,
          to: tokenAddress,
          data: tokenContract.methods.buyToken().encodeABI(),
          value: web3.utils.toWei(amountInCRO.toString(), 'ether'),
          gas: 2000000,
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        ctx.reply(`Successfully bought ${ctx.session.tokenInfo.tokenSymbol}. Transaction receipt: ${receipt.transactionHash}`);
        await saveUserCronosAddress(ctx.from.id, userAddress, ctx.session.tokenInfo.tokenSymbol);
      } catch (error) {
        console.error('Error buying token:', error);
        ctx.reply('Failed to buy token. Please try again later.');
      }

      ctx.session.expectingBuyAmount = false;
    }
  }
}

async function sendTokenInfo(ctx, tokenInfo, userBalance) {
  ctx.reply(
    `Token Information:\nName: ${tokenInfo.tokenName}\nSymbol: ${tokenInfo.tokenSymbol}\nCurrent Price (CRO): ${tokenInfo.currentPriceCRO}\nCurrent Price (USD): ${tokenInfo.currentPriceUSD}\nMarket Cap: ${tokenInfo.marketCap}\nDexScreener URL: ${tokenInfo.url}\n\nYour CRO Balance: ${userBalance}`,
    Markup.inlineKeyboard([
      Markup.button.callback('BUY', 'buy_token'),
      Markup.button.callback('Open Positions', 'open_positions'),
      Markup.button.callback('Paste Token', 'paste_token')
    ])
  );
}

async function sendBalanceAndOptions(ctx, balance) {
  ctx.reply(`Cronos Balance: ${balance}`, Markup.inlineKeyboard([
    Markup.button.callback('Paste Token', 'paste_token'),
    Markup.button.callback('Open Positions', 'open_positions'),
    Markup.button.callback('Help', 'help'),
    Markup.button.callback('Settings', 'settings')
  ]));
}

export { handleStart, handleCallbackQuery, handleMessage };
