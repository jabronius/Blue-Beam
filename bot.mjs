import { Telegraf, session } from 'telegraf'; // Import session along with Telegraf
import dotenv from 'dotenv';
import { handleStart, handleCallbackQuery, handleMessage } from './handlers.mjs';

dotenv.config(); // This loads the .env file at the start of your application

console.log("Starting bot setup...");
console.log("Imported handlers:", { handleStart, handleCallbackQuery, handleMessage });

const bot = new Telegraf(process.env.TELEGRAM_API_KEY); // Ensure this matches your .env key

// Use session middleware
bot.use(session());

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);
bot.on('text', handleMessage);

bot.launch().then(() => {
  console.log("Bot is running...");
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
