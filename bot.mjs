import Web3 from 'web3';
import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';
import { handleStart, handleCallbackQuery } from './keyboardHandlers.mjs';

dotenv.config();  // Load environment variables from .env file

const telegramApiKey = process.env.TELEGRAM_API_KEY;
const cronosRpcUrl = process.env.CRONOS_NODE_URL;
const devAccount = process.env.DEV_ACCOUNT_ADDRESS;
const privateKey = process.env.PRIVATE_KEY; // Ensure PRIVATE_KEY is set in .env if needed

// Validate that the variables are loaded correctly
console.log('TELEGRAM_API_KEY:', telegramApiKey);
console.log('CRONOS_NODE_URL:', cronosRpcUrl);
console.log('DEV_ACCOUNT_ADDRESS:', devAccount);

const web3 = new Web3(new Web3.providers.HttpProvider(cronosRpcUrl));
const bot = new Telegraf(telegramApiKey);

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);

// Launch the bot
bot.launch().then(() => {
  console.log('Bot is running...');
});
