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
const CRONOS_SCAN_API_URL = 'https://api.cronoscan.com/api';
const RPC_URLS = [
  'https://cronos-evm-rpc.publicnode.com/',
  'https://evm-cronos.crypto.org/'
];

function getWeb3Instance(network, retries = 3) {
  let rpcUrl;
  if (network === 'testnet') {
    rpcUrl = config.tcronosRpcUrl;
  } else if (network === 'zkEVM') {
    rpcUrl = config.zkCronosRpcUrl;
  } else {
    rpcUrl = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
  }
  return new Web3(new Web3.providers.HttpProvider(rpcUrl));
}

async function getCronosBalance(address, network, retries = 3) {
  try {
    const web3 = getWeb3Instance(network);
    const balanceWei = await web3.eth.getBalance(address);
    return web3.utils.fromWei(balanceWei, 'ether');
  } catch (error) {
    console.error(`Error fetching Cronos balance (attempt ${4 - retries}):`, error);
    if (retries > 0) {
      return getCronosBalance(address, network, retries - 1);
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
      console.warn('No pairs found for the given token address:', tokenAddress);
      return null;
    }
    const pair = data.pairs[0];

    return {
      tokenName: pair.baseToken.name,
      tokenSymbol: pair.baseToken.symbol,
      currentPriceCRO: parseFloat(pair.priceNative),
      currentPriceUSD: parseFloat(pair.priceUsd),
      marketCap: parseFloat(pair.fdv),
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
  const apiKey = 'BM5H9MZ1S8YDMF91FYCF3FGWJ732F94GTA';  // Your CronosScan API key
  try {
    const response = await axios.get(`${CRONOS_SCAN_API_URL}?module=contract&action=getabi&address=${tokenAddress}&apikey=${apiKey}`);
    const data = response.data;

    // Handle case where API key is invalid or other errors
    if (data.status !== '1') {
      throw new Error(`CronosScan API error: ${data.message}`);
    }

    const abi = JSON.parse(data.result);
    return abi;
  } catch (error) {
    console.error('Error fetching token ABI:', error);
    return null;
  }
}

async function fetchTokens(walletAddress, web3, retries = 3) {
  try {
    const apiKey = 'BM5H9MZ1S8YDMF91FYCF3FGWJ732F94GTA';  // Your CronosScan API key
    const response = await axios.get(`${CRONOS_SCAN_API_URL}?module=account&action=tokentx&address=${walletAddress}&apikey=${apiKey}`);
    const data = response.data;

    if (data.status !== '1') {
      throw new Error(`CronosScan API error: ${data.message}`);
    }

    const tokenTransactions = data.result;
    const uniqueTokenAddresses = [...new Set(tokenTransactions.map(tx => tx.contractAddress))];

    const holdings = [];
    for (const tokenAddress of uniqueTokenAddresses) {
      console.log(`Fetching token balance for address: ${tokenAddress}`);
      const tokenABI = await fetchTokenABI(tokenAddress);
      if (!tokenABI) {
        console.error(`Failed to fetch ABI for token ${tokenAddress}`);
        continue;
      }

      const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      const tokenBalanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
      const tokenDecimals = await tokenContract.methods.decimals().call();

      // Convert BigInt to string for handling decimals
      const tokenBalance = BigInt(tokenBalanceWei) / BigInt(Math.pow(10, Number(tokenDecimals)));
      const tokenBalanceFormatted = tokenBalance.toString();

      console.log(`Token Address: ${tokenAddress}, Balance: ${tokenBalanceFormatted}`); // Log token balance

      if (Number(tokenBalanceFormatted) === 0) {
        continue; // Skip tokens with zero balance
      }

      const tokenInfo = await getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        console.error(`Failed to fetch info for token ${tokenAddress}`);
        continue;
      }

      const tokenValueUSD = Number(tokenBalance) * tokenInfo.currentPriceUSD;

      holdings.push({
        token: tokenInfo.tokenSymbol,
        balance: tokenBalanceFormatted,
        valueUSD: tokenValueUSD,
        tokenAddress: tokenAddress,
        tokenInfo: tokenInfo,
        quantity: tokenBalanceFormatted, // Add quantity field to holdings
        abi: tokenABI, // Add the ABI to the token holdings
      });
    }

    return holdings;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    if (retries > 0) {
      console.log(`Retrying... (${retries - 1} attempts left)`);
      return fetchTokens(walletAddress, web3, retries - 1);
    }
    return [];
  }
}

async function calculateProfitAndMetrics(tokenHoldings, tokenInfo) {
  if (!tokenInfo) {
    return null;
  }

  // Placeholder implementation for profit calculation
  const initialInvestmentCRO = 1; // Example initial investment in CRO
  const currentValueCRO = parseFloat(tokenHoldings.balance) * tokenInfo.currentPriceCRO;
  const profitCRO = currentValueCRO - initialInvestmentCRO;
  const profitPercent = (profitCRO / initialInvestmentCRO) * 100;
  const valueUSD = parseFloat(tokenHoldings.valueUSD);
  const valueCRO = parseFloat(tokenHoldings.balance);
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
    priceChanges: priceChanges,
    quantity: tokenHoldings.quantity, // Include quantity in the metrics
  };
}

async function getWalletDetails(userId) {
  const mnemonicData = await db.get('SELECT mnemonic FROM users WHERE telegramUserId = ?', [userId]);
  if (!mnemonicData) {
    throw new Error("No mnemonic data found. Please create or import a wallet.");
  }

  const seedData = await bip39.mnemonicToSeed(mnemonicData.mnemonic);
  const hdWalletData = hdkey.fromMasterSeed(seedData);
  const keyData = hdWalletData.derivePath("m/44'/60'/0'/0/0");
  const derivedWalletData = keyData.getWallet();
  const privateKey = derivedWalletData.getPrivateKeyString();
  const address = derivedWalletData.getChecksumAddressString();

  return { address, privateKey };
}

async function handleSellToken(ctx, percentage) {
  const userId = ctx.from.id;
  const walletDetails = await getWalletDetails(userId);
  const walletAddress = walletDetails.address;
  const privateKey = walletDetails.privateKey;

  const web3 = getWeb3Instance('mainnet');
  const tokenHoldings = await fetchTokens(walletAddress, web3);

  if (tokenHoldings.length === 0) {
    ctx.reply("No token holdings found in your wallet.");
    return;
  }

  const currentTokenIndex = ctx.session.currentTokenIndex || 0;
  const holding = tokenHoldings[currentTokenIndex];

  if (!holding) {
    ctx.reply("Invalid token index. Please refresh and try again.");
    return;
  }

  const tokenInfo = holding.tokenInfo;
  const amountToSell = (parseFloat(holding.balance) * (percentage / 100)).toFixed(4);

  const tokenContract = new web3.eth.Contract(holding.abi, holding.tokenAddress);
  const amountInWei = web3.utils.toWei(amountToSell.toString(), 'ether');

  // VVS Finance Router address and methods for swapping tokens
  const vvsRouterAddress = '0xd5a26f542b5e0fb87e6e24a216af0fd2e44c5dc8';
  const vvsRouterABI = [
    {
      "constant": false,
      "inputs": [
        {"name": "amountIn", "type": "uint256"},
        {"name": "amountOutMin", "type": "uint256"},
        {"name": "path", "type": "address[]"},
        {"name": "to", "type": "address"},
        {"name": "deadline", "type": "uint256"}
      ],
      "name": "swapExactTokensForTokens",
      "outputs": [{"name": "amounts", "type": "uint256[]"}],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  const vvsRouterContract = new web3.eth.Contract(vvsRouterABI, vvsRouterAddress);

  const path = [holding.tokenAddress, '0x0000000000000000000000000000000000000000']; // Token to CRO path (replace with actual CRO address)
  const amountOutMin = 0; // You might want to calculate the minimum amount out based on slippage

  const tx = vvsRouterContract.methods.swapExactTokensForTokens(
    amountInWei,
    amountOutMin,
    path,
    walletAddress,
    Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time
  );

  try {
    const gas = await tx.estimateGas({ from: walletAddress });
    const gasPrice = await web3.eth.getGasPrice();

    const data = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(walletAddress);

    const txData = {
      from: walletAddress,
      to: vvsRouterAddress,
      data,
      gas,
      gasPrice,
      nonce,
      value: '0x0',
    };

    const signedTx = await web3.eth.accounts.signTransaction(txData, privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    ctx.reply(`Swapped ${amountToSell} ${tokenInfo.tokenSymbol} (${percentage}% of your holdings) for CRO. Transaction Hash: ${receipt.transactionHash}`);
  } catch (error) {
    console.error(`Error swapping token ${tokenInfo.tokenSymbol}:`, error);
    ctx.reply(`Failed to swap ${amountToSell} ${tokenInfo.tokenSymbol}. Error: ${error.message}`);
  }
}


// Example for selling 25%
async function handleSell25(ctx) {
  await handleSellToken(ctx, 25);
}

// Add handlers for other percentages and custom amount
async function handleSell50(ctx) {
  await handleSellToken(ctx, 50);
}

async function handleSell100(ctx) {
  await handleSellToken(ctx, 100);
}

async function handleSellCustom(ctx) {
  ctx.session.expectingSellAmount = true;
  ctx.reply('Please enter the amount you want to sell:');
}

async function handleSellAndManage(ctx) {
  if (!ctx.session) {
    ctx.session = {};
  }

  const walletAddress = await getAddressByUserId(ctx.from.id);
  if (!walletAddress) {
    ctx.reply("No wallet found. Please create or import a wallet.");
    return;
  }

  const web3 = getWeb3Instance('mainnet');
  const tokenHoldings = await fetchTokens(walletAddress, web3);

  if (tokenHoldings.length === 0) {
    ctx.reply("No token holdings found in your wallet.");
    return;
  }

  if (typeof ctx.session.currentTokenIndex === 'undefined') {
    ctx.session.currentTokenIndex = 0;
  }

  if (typeof ctx.session.totalTokens === 'undefined') {
    ctx.session.totalTokens = tokenHoldings.length;
  }

  const currentTokenIndex = ctx.session.currentTokenIndex;
  const holding = tokenHoldings[currentTokenIndex];

  const tokenInfo = holding.tokenInfo;
  const metrics = await calculateProfitAndMetrics(holding, tokenInfo);

  let message = `Token Holdings:\n\n`;

  message += `${tokenInfo.tokenName} | ${tokenInfo.tokenSymbol}\n`;
  message += `Profit: ${metrics.profitPercent}% / ${metrics.profitCRO} CRO\n`;
  message += `Value: $${metrics.valueUSD} / ${metrics.valueCRO} CRO\n`;
  message += `Mcap: $${metrics.marketCap} @ $${metrics.price}\n`;
  message += `5m: ${metrics.priceChanges.m5}%, 1h: ${metrics.priceChanges.h1}%, 6h: ${metrics.priceChanges.h6}%, 24h: ${metrics.priceChanges.h24}%\n\n`;

  await ctx.reply(message, Markup.inlineKeyboard([
    [Markup.button.callback('Previous', 'prev_token'), Markup.button.callback('Next', 'next_token')],
    [Markup.button.callback('Sell 25%', 'sell_25'), Markup.button.callback('Sell 50%', 'sell_50')],
    [Markup.button.callback('Sell 100%', 'sell_100'), Markup.button.callback('Sell Custom Amount', 'sell_custom')],
    [Markup.button.callback('Open Positions', 'open_positions'), Markup.button.callback('Show Wallet', 'wallet')],
    [Markup.button.callback('Paste Token', 'paste_token'), Markup.button.callback('Refresh', 'refresh_data')]
  ]));
}

async function handlePrevToken(ctx) {
  if (!ctx.session) {
    ctx.session = {};
  }

  if (typeof ctx.session.currentTokenIndex === 'undefined') {
    ctx.session.currentTokenIndex = 0;
  }

  ctx.session.currentTokenIndex = (ctx.session.currentTokenIndex - 1 + ctx.session.totalTokens) % ctx.session.totalTokens;
  await handleSellAndManage(ctx);
}

async function handleNextToken(ctx) {
  if (!ctx.session) {
    ctx.session = {};
  }

  if (typeof ctx.session.currentTokenIndex === 'undefined') {
    ctx.session.currentTokenIndex = 0;
  }

  ctx.session.currentTokenIndex = (ctx.session.currentTokenIndex + 1) % ctx.session.totalTokens;
  await handleSellAndManage(ctx);
}

async function handleStart(ctx) {
  await ctx.reply('Welcome to the Cronos Trading Bot! Please choose an option:',
    Markup.inlineKeyboard([
      Markup.button.callback('Create Wallet', 'create_wallet'),
      Markup.button.callback('Sell and Manage', 'sell_and_manage'),
      Markup.button.callback('Paste Token', 'paste_token'),
      Markup.button.callback('Open Positions', 'open_positions'),
      Markup.button.callback('Show Cronos wallet address and Private Key', 'wallet')
    ])
  );
}

async function handleCallbackQuery(ctx) {
  if (!ctx.session) {
    ctx.session = {};
  }

  const action = ctx.callbackQuery.data;

  switch (action) {
    case 'create_wallet':
      const existingAddress = await getAddressByUserId(ctx.from.id);
      if (existingAddress) {
        await ctx.reply(`You already have a wallet: ${existingAddress}`);
        return;
      }
      const mnemonic = bip39.generateMnemonic();
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const hdWallet = hdkey.fromMasterSeed(seed);
      const key = hdWallet.derivePath("m/44'/60'/0'/0/0");
      const wallet = key.getWallet();
      const address = wallet.getChecksumAddressString();
      await saveUserCronosAddress(ctx.from.id, address, mnemonic); // Ensure we update the address in the database
      const balance = await getCronosBalance(address, 'mainnet');
      await ctx.reply(`Wallet created! Address: \`${address}\``, { parse_mode: 'MarkdownV2' });
      if (balance) {
        await sendBalanceAndOptions(ctx, balance, 'mainnet');
      } else {
        ctx.reply("Failed to create wallet. Please try again.");
      }
      break;
    case 'sell_and_manage':
      await handleSellAndManage(ctx);
      break;
    case 'sell_25':
      await handleSell25(ctx);
      break;
    case 'sell_50':
      await handleSell50(ctx);
      break;
    case 'sell_100':
      await handleSell100(ctx);
      break;
    case 'sell_custom':
      await handleSellCustom(ctx);
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
    case 'wallet':
      const walletAddress = await getAddressByUserId(ctx.from.id);
      if (!walletAddress) {
        ctx.reply("No wallet found. Please create or import a wallet.");
        return;
      }

      const mnemonicData = await db.get('SELECT mnemonic FROM users WHERE telegramUserId = ?', [ctx.from.id]);
      if (!mnemonicData) {
        ctx.reply("No mnemonic data found. Please create or import a wallet.");
        return;
      }

      const seedData = await bip39.mnemonicToSeed(mnemonicData.mnemonic);
      const hdWalletData = hdkey.fromMasterSeed(seedData);
      const keyData = hdWalletData.derivePath("m/44'/60'/0'/0/0");
      const derivedWalletData = keyData.getWallet();
      const privateKeyData = derivedWalletData.getPrivateKeyString();

      // Verify that the private key matches the wallet address
      const derivedAddressData = derivedWalletData.getChecksumAddressString();
      if (derivedAddressData.toLowerCase() !== walletAddress.toLowerCase()) {
        ctx.reply("The derived address from the private key does not match the stored wallet address.");
        return;
      }

      await ctx.replyWithMarkdownV2(
        `Wallet Address: \`${walletAddress}\`\n\nPrivate Key: \`${privateKeyData}\``
      );
      break;
    case 'open_positions':
      await displayCombinedHoldings(ctx);
      break;
    case 'refresh_data':
      await handleSellAndManage(ctx); // Reload the sell and manage data
      break;
    case 'prev_token':
      await handlePrevToken(ctx);
      break;
    case 'next_token':
      await handleNextToken(ctx);
      break;
    default:
      ctx.reply('Unknown command.');
      break;
  }
}

async function handleMessage(ctx) {
  if (!ctx.session) {
    ctx.session = {};
  }

  const text = ctx.message.text.trim().toLowerCase();
  if (ctx.session.expectingTokenAddress) {
    ctx.session.expectingTokenAddress = false;
    const tokenInfo = await getTokenInfo(text);
    if (tokenInfo) {
      const walletAddress = await getAddressByUserId(ctx.from.id);
      const userBalance = await getCronosBalance(walletAddress, 'mainnet');
      ctx.session.tokenInfo = tokenInfo;
      await sendTokenInfo(ctx, tokenInfo, userBalance, 'mainnet');
    } else {
      ctx.reply('Failed to fetch token information. Please make sure the token address is correct.');
    }
  } else if (ctx.session.expectingSellAmount) {
    ctx.session.expectingSellAmount = false;
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      ctx.reply('Invalid amount. Please enter a valid number.');
    } else {
      // Handle selling the custom amount
      await handleSellToken(ctx, amount);
    }
  } else {
    switch (text) {
      case '/home':
        await ctx.reply('Choose an option:',
          Markup.inlineKeyboard([
            [Markup.button.callback('Create Wallet', 'create_wallet'), Markup.button.callback('Sell and Manage', 'sell_and_manage')],
            [Markup.button.callback('Paste Token', 'paste_token'), Markup.button.callback('Open Positions', 'open_positions')],
            [Markup.button.callback('Show Cronos wallet address and Private Key', 'wallet')]
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
      case '/wallet':
        const walletAddr = await getAddressByUserId(ctx.from.id);
        if (!walletAddr) {
          ctx.reply("No wallet found. Please create or import a wallet.");
          return;
        }

        const mnemonicData = await db.get('SELECT mnemonic FROM users WHERE telegramUserId = ?', [ctx.from.id]);
        if (!mnemonicData) {
          ctx.reply("No mnemonic data found. Please create or import a wallet.");
          return;
        }

        const seedData = await bip39.mnemonicToSeed(mnemonicData.mnemonic);
        const hdWalletData = hdkey.fromMasterSeed(seedData);
        const keyData = hdWalletData.derivePath("m/44'/60'/0'/0/0");
        const derivedWalletData = keyData.getWallet();
        const privateKeyData = derivedWalletData.getPrivateKeyString();

        // Verify that the private key matches the wallet address
        const derivedAddressData = derivedWalletData.getChecksumAddressString();
        if (derivedAddressData.toLowerCase() !== walletAddr.toLowerCase()) {
          ctx.reply("The derived address from the private key does not match the stored wallet address.");
          return;
        }

        await ctx.replyWithMarkdownV2(
          `Wallet Address: \`${walletAddr}\`\n\nPrivate Key: \`${privateKeyData}\``
        );
        break;
      default:
        ctx.reply('Unknown command. Please use one of the available commands.');
        break;
    }
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
  const walletAddress = await getAddressByUserId(ctx.from.id);
  ctx.replyWithMarkdownV2(
    `Cronos ${network === 'testnet' ? 'Testnet' : (network === 'zkEVM' ? 'zkEVM' : 'Mainnet')} Balance: ${balance} ${network === 'testnet' ? 'tCRO' : (network === 'zkEVM' ? 'zkCRO' : 'CRO')}\n\n*Wallet Address:* \`${walletAddress}\``,
    Markup.inlineKeyboard([
      Markup.button.callback('Paste Token', 'paste_token'),
      Markup.button.callback('Open Positions', 'open_positions')
    ])
  );
}

async function displayCombinedHoldings(ctx) {
  const walletAddress = await getAddressByUserId(ctx.from.id);
  if (!walletAddress) {
    ctx.reply("No wallet found. Please create or import a wallet.");
    return;
  }

  const web3 = getWeb3Instance('mainnet');
  const croBalance = await getCronosBalance(walletAddress, 'mainnet');
  const tokenHoldings = await fetchTokens(walletAddress, web3);

  let message = `Positions Overview: (CRONOS MAINNET)\nWallet Address: ${walletAddress}\n\n`;

  console.log('Token Holdings:', tokenHoldings); // Log token holdings

  let totalTokenValueUSD = 0;
  for (const [index, holding] of tokenHoldings.entries()) {
    const tokenInfo = holding.tokenInfo;

    const metrics = await calculateProfitAndMetrics(holding, tokenInfo);
    if (!metrics) {
      message += `/${index + 1} Metrics Calculation Failed\n\n`;
      continue;
    }

    totalTokenValueUSD += parseFloat(metrics.valueUSD);

    message += `/${index + 1} ${tokenInfo.tokenSymbol}\n`;
    message += `Profit: ${metrics.profitPercent}% / ${metrics.profitCRO} CRO\n`;
    message += `Value: $${metrics.valueUSD} / ${metrics.valueCRO} CRO\n`;
    message += `Tokens Held: ${metrics.quantity}\n`; // Include Tokens Held
    message += `Mcap: $${metrics.marketCap} @ $${metrics.price}\n`;
    message += `5m: ${metrics.priceChanges.m5}%, 1h: ${metrics.priceChanges.h1}%, 6h: ${metrics.priceChanges.h6}%, 24h: ${metrics.priceChanges.h24}%\n\n`;
  }

  const netWorthCRO = (parseFloat(croBalance) + totalTokenValueUSD).toFixed(4);

  message += `Balance: ${parseFloat(croBalance).toFixed(4)} CRO\n`;
  message += `Net Worth: ${netWorthCRO} CRO / $${totalTokenValueUSD.toFixed(2)}\n`;

  await ctx.reply(message, Markup.inlineKeyboard([
    Markup.button.callback('BUY', 'buy_token'),
    Markup.button.callback('Paste Token', 'paste_token'),
    Markup.button.callback('Sell and Manage', 'sell_and_manage'),
    Markup.button.callback('Wallet', 'wallet')
  ]));
}

export { handleStart, handleCallbackQuery, handleMessage, fetchTokenABI, getTokenInfo };
