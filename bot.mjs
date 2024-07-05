import axios from 'axios';
import axiosRetry from 'axios-retry';
import { config } from './config.mjs';
import { Telegraf, Markup } from 'telegraf';

axiosRetry(axios, { retries: 3 });

const bot = new Telegraf(config.telegramApiKey);

bot.start((ctx) => {
  ctx.reply('Welcome to the Cronos Trading Bot! Use /setaddress to set the smart contract address.');
});

bot.command('setaddress', (ctx) => {
  const address = ctx.message.text.split(' ')[1];
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    smartContractAddress = address;
    ctx.reply('Smart contract address set!', Markup.inlineKeyboard([
      Markup.button.callback('Buy', 'buy'),
      Markup.button.callback('Sell', 'sell'),
      Markup.button.callback('Check Balance', 'check_balance')
    ]));
  } else {
    ctx.reply('Invalid smart contract address. Please enter a valid address.');
  }
});

bot.command('buy', async (ctx) => {
  try {
    const transactionResult = await buyToken(ctx);
    ctx.reply(`Buy command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing buy command:', error);
    ctx.reply('Failed to execute buy command.');
  }
});

bot.command('sell', async (ctx) => {
  try {
    const transactionResult = await sellToken(ctx);
    ctx.reply(`Sell command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing sell command:', error);
    ctx.reply('Failed to execute sell command.');
  }
});

bot.command('balance', async (ctx) => {
  try {
    const balance = await getBalance(ctx);
    ctx.reply(`Your current balance is: ${balance}`);
  } catch (error) {
    console.error('Error checking balance:', error);
    ctx.reply('Failed to check balance.');
  }
});

async function buyToken(ctx) {
  if (!smartContractAddress) {
    return 'Smart contract address not set.';
  }
  // Implement your buy logic here, using the smartContractAddress
  return 'Transaction ID for Buy';
}

async function sellToken(ctx) {
  if (!smartContractAddress) {
    return 'Smart contract address not set.';
  }
  // Implement your sell logic here, using the smartContractAddress
  return 'Transaction ID for Sell';
}

async function getBalance(ctx) {
  if (!smartContractAddress) {
    return 'Smart contract address not set.';
  }
  // Implement your balance check logic here, using the smartContractAddress
  return '1000 tokens';
}

bot.launch().then(() => {
  console.log('Bot is running...');
});
