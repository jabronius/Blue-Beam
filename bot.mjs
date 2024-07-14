// bot.mjs

import Web3 from 'web3';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { config } from './config.mjs';
import { handleStart, handleCallbackQuery } from './keyboardHandlers.mjs';
// note
dotenv.config();  // Load environment variables from .env file

// Validate that the variables are loaded correctly
console.log('TELEGRAM_API_KEY:', config.telegramApiKey);
console.log('CRONOS_NODE_URL:', config.cronosRpcUrl);
console.log('DEV_ACCOUNT_ADDRESS:', config.devAccount);

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));
const bot = new Telegraf(config.telegramApiKey);

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);

// Launch the bot
bot.launch().then(() => {
  console.log('Bot is running...');
});



console.log('CRONOS_NODE_URL in bot.mjs:', config.cronosRpcUrl);
