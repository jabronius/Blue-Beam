import { Telegraf, session } from 'telegraf';
import { handleStart, handleCallbackQuery, handleMessage } from './handlers.mjs';
import { config } from './config.mjs';

console.log('Telegram API Key:', config.telegramApiKey);  // Debugging statement
console.log('Cronos Node URL:', config.cronosRpcUrl);  // Debugging statement

const bot = new Telegraf(config.telegramApiKey);

bot.use(session());

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);
bot.on('text', handleMessage);

bot.launch().then(() => {
  console.log('Bot launched successfully');
}).catch((error) => {
  console.error('Error launching bot:', error);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
