import { config } from './config.mjs';
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(config.telegramApiKey);

bot.start((ctx) => {
  ctx.reply('Welcome to the Cronos Trading Bot! Please paste the smart contract address of the meme coin:');
});

bot.on('text', async (ctx) => {
  const smartContractAddress = ctx.message.text;

  if (/^0x[a-fA-F0-9]{40}$/.test(smartContractAddress)) {
    ctx.reply('Smart contract address received!', Markup.inlineKeyboard([
      Markup.button.callback('Buy', 'buy'),
      Markup.button.callback('Sell', 'sell'),
      Markup.button.callback('Check Balance', 'check_balance')
    ]));
  } else {
    ctx.reply('Invalid smart contract address. Please enter a valid address:');
  }
});

bot.action('buy', async (ctx) => {
  try {
    const transactionResult = await buyToken(ctx);
    ctx.reply(`Buy command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing buy command:', error);
    ctx.reply('Failed to execute buy command.');
  }
});

bot.action('sell', async (ctx) => {
  try {
    const transactionResult = await sellToken(ctx);
    ctx.reply(`Sell command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing sell command:', error);
    ctx.reply('Failed to execute sell command.');
  }
});

bot.action('check_balance', async (ctx) => {
  try {
    const balance = await getBalance(ctx);
    ctx.reply(`Your current balance is: ${balance}`);
  } catch (error) {
    console.error('Error checking balance:', error);
    ctx.reply('Failed to check balance.');
  }
});

async function buyToken(ctx) {
  return 'Transaction ID for Buy';
}

async function sellToken(ctx) {
  return 'Transaction ID for Sell';
}

async function getBalance(ctx) {
  return '1000 tokens';
}

bot.launch().then(() => {
  console.log('Bot is running...');
});
