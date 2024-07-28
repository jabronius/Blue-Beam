import { Telegraf, session } from 'telegraf';
import { handleStart, handleCallbackQuery, handleMessage } from './handlers.mjs';
import { config } from './config.mjs';

const bot = new Telegraf(config.telegramApiKey);

console.log('Telegram API Key:', config.telegramApiKey);
console.log('Cronos Node URL:', config.cronosRpcUrl);

bot.use(session());
bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);
bot.on('message', handleMessage);

bot.launch().then(() => {
  console.log('Bot launched successfully.');
}).catch(error => {
  console.error('Error launching bot:', error);
});
