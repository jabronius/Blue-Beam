// bot.mjs

import { Telegraf } from 'telegraf';
import { config } from './config.mjs';
import { handleStart, handleCallbackQuery } from './handlers.mjs';

const bot = new Telegraf(config.telegramApiKey);

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);

bot.launch().then(() => {
  console.log('Bot is running...');
}).catch(err => {
  console.error('Failed to launch bot:', err);
});
