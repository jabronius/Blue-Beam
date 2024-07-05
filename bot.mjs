import { config } from './config.mjs';
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(config.telegramApiKey);

bot.start((ctx) => {
  ctx.reply('Welcome to the Cronos Trading Bot!', Markup.inlineKeyboard([
    Markup.button.callback('Buy', 'buy'),
    Markup.button.callback('Sell', 'sell'),
    Markup.button.callback('Check Balance', 'check_balance')
  ]));
});

bot.action('buy', async (ctx) => {
  try {
    // Implement your buy logic here, e.g., interact with a smart contract
    const transactionResult = await buyToken(); // Replace with your actual function
    ctx.reply(`Buy command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing buy command:', error);
    ctx.reply('Failed to execute buy command.');
  }
});


bot.action('sell', async (ctx) => {
  try {
    // Implement your sell logic here
    const transactionResult = await sellToken(); // Replace with your actual function
    ctx.reply(`Sell command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing sell command:', error);
    ctx.reply('Failed to execute sell command.');
  }
});


bot.action('check_balance', async (ctx) => {
  try {
    // Implement your balance check logic here
    const balance = await getBalance(); // Replace with your actual function
    ctx.reply(`Your current balance is: ${balance}`);
  } catch (error) {
    console.error('Error checking balance:', error);
    ctx.reply('Failed to check balance.');
  }
});

