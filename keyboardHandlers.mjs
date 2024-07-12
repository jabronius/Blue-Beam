// keyboardHandlers.mjs

import Web3 from 'web3';
import { Markup } from 'telegraf';
import { config } from './config.mjs';

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));
let smartContractAddress = '';

// Function to handle the start command ; good stuff
export function handleStart(ctx) {
  ctx.reply(
    'Welcome to the Cronos Trading Bot! Please choose an option:',
    Markup.inlineKeyboard([
      Markup.button.callback('Import Cronos Chain Wallet', 'import_wallet'),
      Markup.button.callback('Create New Cronos Chain Wallet', 'create_wallet')
    ])
  );
}

// Function to handle callback queries from inline keyboard buttons
export async function handleCallbackQuery(ctx) {
  const action = ctx.callbackQuery.data;

  if (action === 'import_wallet') {
    ctx.reply('Please send your private key to import your Cronos Chain wallet.');
    // You can then listen for the next message containing the private key
    ctx.telegram.on('text', async (msgCtx) => {
      const privateKey = msgCtx.message.text;
      try {
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        // Store the imported private key securely
        // e.g., store in database or a secure variable
        msgCtx.reply(`Wallet imported successfully! Address: ${account.address}`);
      } catch (error) {
        msgCtx.reply('Invalid private key. Please try again.');
      }
    });
  }

  if (action === 'create_wallet') {
    const account = web3.eth.accounts.create();
    // Store the newly created private key securely
    // e.g., store in database or a secure variable
    ctx.reply(`New wallet created successfully! Address: ${account.address}\nPrivate Key: ${account.privateKey}`);
  }

  if (action === 'buy') {
    try {
      const transactionResult = await buyToken(ctx);
      ctx.reply(`Buy command executed successfully: ${transactionResult}`);
    } catch (error) {
      console.error('Error executing buy command:', error);
      ctx.reply('Failed to execute buy command.');
    }
  }

  if (action === 'sell') {
    try {
      const transactionResult = await sellToken(ctx);
      ctx.reply(`Sell command executed successfully: ${transactionResult}`);
    } catch (error) {
      console.error('Error executing sell command:', error);
      ctx.reply('Failed to execute sell command.');
    }
  }

  if (action === 'check_balance') {
    try {
      const balance = await getBalance(ctx);
      ctx.reply(`Your current balance is: ${balance}`);
    } catch (error) {
      console.error('Error checking balance:', error);
      ctx.reply('Failed to check balance.');
    }
  }
}

async function buyToken(ctx) {
  // Implementation of buyToken function
}

async function sellToken(ctx) {
  // Implementation of sellToken function
}

async function getBalance(ctx) {
  // Implementation of getBalance function
}

console.log('CRONOS_NODE_URL in keyboardHandlers.mjs:', config.cronosRpcUrl);
