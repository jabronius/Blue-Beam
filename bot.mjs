// bot.mjs

import { Telegraf } from 'telegraf';
import { config } from './config.mjs';
import { handleStart, handleCallbackQuery, handleMessage } from './handlers.mjs';

// Debugging: Check if the token is loaded correctly
console.log('Telegram API Key:', config.telegramApiKey);

if (!config.telegramApiKey) {
  console.error('Error: Telegram API Key is missing.');
  process.exit(1);
}

const bot = new Telegraf(config.telegramApiKey);

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);
bot.on('text', handleMessage);

// Start the bot
bot.launch()
  .then(() => {
    console.log('Bot launched successfully!');
  })
  .catch((error) => {
    console.error('Error launching bot:', error);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
import { Telegraf } from 'telegraf';
import { config } from './config.mjs';
import { handleStart, handleCallbackQuery, handleMessage } from './handlers.mjs';

const bot = new Telegraf(config.telegramBotToken);

console.log('Initializing bot...');

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);
bot.on('text', handleMessage);

bot.launch()
  .then(() => {
    console.log('Bot launched successfully');
  })
  .catch(error => {
    console.error('Error launching bot:', error);
  });

// Adding a simple API check to verify connectivity
async function checkTelegramAPI() {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${config.telegramBotToken}/getMe`);
    console.log('Telegram API Response:', response.data);
  } catch (error) {
    console.error('Error accessing Telegram API:', error.message);
  }
}

checkTelegramAPI();
