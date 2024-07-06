import Web3 from 'web3';
import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';
import { config } from './config.mjs';
import { handleStart, handleCallbackQuery } from './keyboardHandlers.mjs';

dotenv.config();  // Load environment variables from .env file

// Validate that the variables are loaded correctly
console.log('TELEGRAM_API_KEY:', config.telegramApiKey);
console.log('CRONOS_NODE_URL:', config.cronosNodeUrl);
console.log('DEV_ACCOUNT_ADDRESS:', config.devAccount);

if (!config.cronosNodeUrl) {
  console.error('CRONOS_NODE_URL is not defined. Please check your .env file.');
  process.exit(1);
}

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosNodeUrl));
const bot = new Telegraf(config.telegramApiKey);

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);

// Launch the bot
bot.launch()
  .then(() => {
    console.log('Bot is running...');
  })
  .catch((error) => {
    console.error('Failed to launch bot:', error);
  });
