import { Telegraf } from 'telegraf';
import { config } from './config.mjs';
import { getPriceOfToken } from './price.mjs';
// bot.mjs (or your main application file)
import Web3 from 'web3';

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosNodeUrl));
// Use web3 for interacting with Cronos blockchain


const bot = new Telegraf(config.telegramApiKey);

bot.start((ctx) => ctx.reply('Welcome to the Cronos Trading Bot!'));
bot.help((ctx) => ctx.reply('Send /price to get the latest price of a token.'));


bot.command('price', async (ctx) => {
  const price = await getPriceOfToken();
  ctx.reply(`The latest price is: ${price}`);
});

bot.launch();

