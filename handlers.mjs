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
const CRONOS_SCAN_API_URL = 'https://api.cronoscan.com/api?module=contract&action=getabi&address=';
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
    const response = await axios.get(`${CRONOS_SCAN_API_URL}${tokenAddress}&apikey=${apiKey}`);
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
  const tokenAddresses = [
    '0x3b41B27E74Dd366CE27cB389dc7877D4e1516d4d', // Add more token addresses as needed
  ];

  const holdings = [];
  for (const tokenAddress of tokenAddresses) {
    const tokenABI = await fetchTokenABI(tokenAddress);
    if (!tokenABI) {
      console.error(`Failed to fetch ABI for token ${tokenAddress}`);
      continue;
    }

    const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
    try {
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
      });
    } catch (error) {
      console.error(`Error fetching balance for token ${tokenAddress}:`, error);
      if (retries > 0) {
        console.log(`Retrying to fetch balance for token ${tokenAddress} (attempt ${4 - retries} left)`);
        return fetchTokens(walletAddress, web3, retries - 1);
      }
    }
  }

  return holdings;
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

      await ctx.reply(
        `Wallet Address: ${walletAddress}\n\nPrivate Key: ${privateKeyData}`
      );
      break;
    case 'open_positions':
      await displayCombinedHoldings(ctx);
      break;
    default:
      ctx.reply('Unknown command.');
      break;
  }
}

async function handleMessage(ctx) {
  const text = ctx.message.text.trim().toLowerCase();
  if (ctx.session && ctx.session.expectingTokenAddress) {
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
  } else {
    switch (text) {
      case '/home':
        await ctx.reply('Choose an option:',
          Markup.inlineKeyboard([
            [Markup.button.callback('Create Wallet', 'create_wallet'), Markup.button.callback('Import Wallet', 'import_wallet')],
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

        const mnemonicDat = await db.get('SELECT mnemonic FROM users WHERE telegramUserId = ?', [ctx.from.id]);
        if (!mnemonicDat) {
          ctx.reply("No mnemonic data found. Please create or import a wallet.");
          return;
        }

        const seedDat = await bip39.mnemonicToSeed(mnemonicDat.mnemonic);
        const hdWalletDat = hdkey.fromMasterSeed(seedDat);
        const keyDat = hdWalletDat.derivePath("m/44'/60'/0'/0/0");
        const derivedWalletDat = keyDat.getWallet();
        const privateKeyDat = derivedWalletDat.getPrivateKeyString();

        // Verify that the private key matches the wallet address
        const derivedAddressDat = derivedWalletDat.getChecksumAddressString();
        if (derivedAddressDat.toLowerCase() !== walletAddr.toLowerCase()) {
          ctx.reply("The derived address from the private key does not match the stored wallet address.");
          return;
        }

        await ctx.reply(
          `Wallet Address: ${walletAddr}\n\nPrivate Key: ${privateKeyDat}`
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
  ctx.reply(`Cronos ${network === 'testnet' ? 'Testnet' : (network === 'zkEVM' ? 'zkEVM' : 'Mainnet')} Balance: ${balance} ${network === 'testnet' ? 'tCRO' : (network === 'zkEVM' ? 'zkCRO' : 'CRO')}`, Markup.inlineKeyboard([
    Markup.button.callback('Paste Token', 'paste_token'),
    Markup.button.callback('Open Positions', 'open_positions')
  ]));
}

async function displayCombinedHoldings(ctx) {
  const walletAddress = await getAddressByUserId(ctx.from.id);
  if (!walletAddress) {
    ctx.reply("No wallet found. Please create or import a wallet.");
    return;
  }

  const web3 = getWeb3Instance('mainnet');
  const mainnetBalance = await getCronosBalance(walletAddress, 'mainnet');
  const mainnetHoldings = await fetchTokens(walletAddress, web3);

  let message = `Positions Overview: (CRONOS MAINNET)\nWallet Address: ${walletAddress}\n\n`;

  console.log('Mainnet Holdings:', mainnetHoldings); // Log mainnet holdings

  for (const [index, holding] of mainnetHoldings.entries()) {
    const tokenInfo = holding.tokenInfo;

    const metrics = await calculateProfitAndMetrics(holding, tokenInfo);
    if (!metrics) {
      message += `/${index + 1} Metrics Calculation Failed\n\n`;
      continue;
    }

    message += `/${index + 1} ${tokenInfo.tokenSymbol}\n`;
    message += `Profit: ${metrics.profitPercent}% / ${metrics.profitCRO} CRO\n`;
    message += `Value: $${metrics.valueUSD} / ${metrics.valueCRO} CRO\n`;
    message += `Tokens Held: ${metrics.quantity}\n`; // Include Tokens Held
    message += `Mcap: $${metrics.marketCap} @ $${metrics.price}\n`;
    message += `5m: ${metrics.priceChanges.m5}%, 1h: ${metrics.priceChanges.h1}%, 6h: ${metrics.priceChanges.h6}%, 24h: ${metrics.priceChanges.h24}%\n\n`;
  }

  let totalBalance = mainnetHoldings.reduce((sum, holding) => sum + parseFloat(holding.balance), 0);
  let totalValueUSD = mainnetHoldings.reduce((sum, holding) => sum + parseFloat(holding.valueUSD), 0);

  totalBalance = (totalBalance + parseFloat(mainnetBalance)).toFixed(4);
  totalValueUSD = totalValueUSD.toFixed(2);

  message += `Balance: ${totalBalance} CRO\n`;
  message += `Net Worth: ${totalBalance} CRO / $${totalValueUSD}\n`;

  await ctx.reply(message, Markup.inlineKeyboard([
    Markup.button.callback('BUY', 'buy_token'),
    Markup.button.callback('Paste Token', 'paste_token')
  ]));
}

export { handleStart, handleCallbackQuery, handleMessage, fetchTokenABI, getTokenInfo };
