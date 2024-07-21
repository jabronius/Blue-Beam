// handlers.mjs

import { Markup } from 'telegraf';
import { config } from './config.mjs';
import Web3 from 'web3';

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));

async function getCronosBalance(userId) {
  try {
    const balance = await web3.eth.getBalance(config.cronosAddress);
    return web3.utils.fromWei(balance, 'ether');
  } catch (error) {
    console.error('Error fetching balance:', error);
    return '0';
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
    case 'paste_token':
      ctx.reply('Select buy option:', Markup.inlineKeyboard([
        Markup.button.callback('1000 Cro Buy', 'buy_1000_cro'),
        Markup.button.callback('Custom Cro Buy', 'buy_custom_cro')
      ]));
      break;
    case 'open_positions':
      await handleOpenPositions(ctx);
      break;
    case 'help':
      await handleHelp(ctx);
      break;
    case 'settings':
      await handleSettings(ctx);
      break;
    case 'buy_1000_cro':
      await handleBuy(ctx, '1000');
      break;
    case 'buy_custom_cro':
      await handleCustomBuy(ctx);
      break;
    default:
      ctx.reply('Unknown action!');
      break;
  }
}

async function handleCreateWallet(ctx) {
  try {
    // Logic to create a new Cronos wallet and store securely
    const account = web3.eth.accounts.create();
    // Store the account securely, for example in a database
    const balance = await getCronosBalance(ctx.from.id);
    await sendBalanceAndOptions(ctx, balance);
  } catch (error) {
    console.error('Error creating wallet:', error);
    ctx.reply('Failed to create wallet.');
  }
}

async function handleImportWallet(ctx) {
  try {
    // Logic to import existing Cronos wallet using private key
    const balance = await getCronosBalance(ctx.from.id);
    await sendBalanceAndOptions(ctx, balance);
  } catch (error) {
    console.error('Error importing wallet:', error);
    ctx.reply('Failed to import wallet.');
  }
}

async function handleBuy(ctx, amount) {
  try {
    const senderAddress = web3.eth.accounts.privateKeyToAccount(config.privateKey).address;
    const buyAmount = web3.utils.toWei(amount, 'ether');
    // Implement buy logic
    ctx.reply(`Buy ${amount} CRO transaction initiated.`);
  } catch (error) {
    console.error('Error executing buy transaction:', error);
    ctx.reply('Failed to execute buy transaction.');
  }
}

async function sendBalanceAndOptions(ctx, balance) {
  ctx.reply(`Cronos Balance: ${balance}`, Markup.inlineKeyboard([
    Markup.button.callback('Paste Token', 'paste_token'),
    Markup.button.callback('Open Positions', 'open_positions'),
    Markup.button.callback('Help', 'help'),
    Markup.button.callback('Settings', 'settings')
  ]));
}

async function handleOpenPositions(ctx) {
  // Implement logic to display current coins owned, PNL % Gains and losses, and option to sell by %
  ctx.reply('Open positions logic not yet implemented.');
}

async function handleHelp(ctx) {
  ctx.reply('Help information not yet implemented.');
}

async function handleSettings(ctx) {
  ctx.reply('Settings options not yet implemented.');
}

async function handleCustomBuy(ctx) {
  ctx.reply('Custom buy logic not yet implemented.');
}

export { handleStart, handleCallbackQuery };
