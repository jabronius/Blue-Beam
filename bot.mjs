// bot.mjs

import Web3 from 'web3';
import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';
import { config } from './config.mjs';
import { handleStart, handleCallbackQuery } from './inlineKeyboardHandlers.mjs';

dotenv.config();  // Load environment variables from .env file

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));
const bot = new Telegraf(config.telegramApiKey);

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);
bot.command('open_position', (ctx) => {
  ctx.reply(
    'Please enter the token contract address:',
    Markup.inlineKeyboard([Markup.button.callback('Enter Contract', 'enter_contract')])
  );
});

bot.launch().then(() => {
  console.log('Bot is running...');
}).catch(err => {
  console.error('Failed to launch bot:', err);
});
