import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';
import { handleStart, handleCallbackQuery, handleMessage } from './handlers.mjs';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_API_KEY);

bot.use(session());

bot.start(handleStart);
bot.on('callback_query', handleCallbackQuery);
bot.on('text', handleMessage);

const launchBot = async (retries = 5) => {
  try {
    await bot.launch();
    console.log("Bot is running...");
  } catch (error) {
    console.error("Failed to launch bot:", error);
    if (retries > 0) {
      console.log(`Retrying to launch bot... (${retries} attempts left)`);
      setTimeout(() => launchBot(retries - 1), 5000);
    } else {
      console.error("All retry attempts failed. Please check your network and API key.");
    }
  }
};

launchBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
