import Web3 from 'web3';
import axios from 'axios';
import dotenv from 'dotenv';
import { Telegraf, Markup } from 'telegraf';

dotenv.config();  // Load environment variables from .env file

const telegramApiKey = process.env.TELEGRAM_API_KEY;
const cronosRpcUrl = process.env.CRONOS_RPC_URL;
const devAccount = process.env.DEV_ACCOUNT_ADDRESS;
const privateKey = process.env.PRIVATE_KEY; // Ensure PRIVATE_KEY is set in .env if needed

// Validate that the variables are loaded correctly
console.log('TELEGRAM_API_KEY:', telegramApiKey);
console.log('CRONOS_RPC_URL:', cronosRpcUrl);
console.log('DEV_ACCOUNT_ADDRESS:', devAccount);

const web3 = new Web3(new Web3.providers.HttpProvider(cronosRpcUrl));
const bot = new Telegraf(telegramApiKey);

bot.start((ctx) => {
  ctx.reply('Welcome to the Cronos Trading Bot! Use /setaddress to set the smart contract address.');
});

bot.command('setaddress', (ctx) => {
  const address = ctx.message.text.split(' ')[1];
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    smartContractAddress = address;
    ctx.reply('Smart contract address set!', Markup.inlineKeyboard([
      Markup.button.callback('Buy', 'buy'),
      Markup.button.callback('Sell', 'sell'),
      Markup.button.callback('Check Balance', 'check_balance')
    ]));
  } else {
    ctx.reply('Invalid smart contract address. Please enter a valid address.');
  }
});

bot.command('buy', async (ctx) => {
  try {
    const transactionResult = await buyToken(ctx);
    ctx.reply(`Buy command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing buy command:', error);
    ctx.reply('Failed to execute buy command.');
  }
});

bot.command('sell', async (ctx) => {
  try {
    const transactionResult = await sellToken(ctx);
    ctx.reply(`Sell command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing sell command:', error);
    ctx.reply('Failed to execute sell command.');
  }
});

bot.command('balance', async (ctx) => {
  try {
    const balance = await getBalance(ctx);
    ctx.reply(`Your current balance is: ${balance}`);
  } catch (error) {
    console.error('Error checking balance:', error);
    ctx.reply('Failed to check balance.');
  }
});

async function buyToken(ctx) {
  const senderAddress = web3.eth.accounts.privateKeyToAccount(config.privateKey).address;
  const smartContractAddress = 'SMART_CONTRACT_ADDRESS'; // Replace with actual contract address
  const buyAmount = web3.utils.toWei('1', 'ether'); // Example buy amount
  const feePercentage = 0.005; // 0.5%
  const feeAmount = buyAmount * feePercentage;
  const actualBuyAmount = buyAmount - feeAmount;

  // Assuming the token has a standard ERC20 `transfer` function
  const tokenAbi = []; // Replace with ABI of the token contract
  const tokenContract = new web3.eth.Contract(tokenAbi, smartContractAddress);

  // Create transactions
  const buyTx = tokenContract.methods.transfer(senderAddress, actualBuyAmount);
  const feeTx = tokenContract.methods.transfer(config.devAccount, feeAmount);

  const buyTxData = buyTx.encodeABI();
  const feeTxData = feeTx.encodeABI();

  const buyTxGas = await buyTx.estimateGas({ from: senderAddress });
  const feeTxGas = await feeTx.estimateGas({ from: senderAddress });

  // Send buy transaction
  const buyTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: buyTxData,
      gas: buyTxGas,
    },
    config.privateKey
  );

  const buyTxReceipt = await web3.eth.sendSignedTransaction(buyTxSigned.rawTransaction);

  // Send fee transaction
  const feeTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: feeTxData,
      gas: feeTxGas,
    },
    config.privateKey
  );

  const feeTxReceipt = await web3.eth.sendSignedTransaction(feeTxSigned.rawTransaction);

  return `Buy TX: ${buyTxReceipt.transactionHash}, Fee TX: ${feeTxReceipt.transactionHash}`;
}

async function sellToken(ctx) {
  const senderAddress = web3.eth.accounts.privateKeyToAccount(config.privateKey).address;
  const smartContractAddress = 'SMART_CONTRACT_ADDRESS'; // Replace with actual contract address
  const sellAmount = web3.utils.toWei('1', 'ether'); // Example sell amount

  // Assuming the token has a standard ERC20 `approve` and `transferFrom` functions
  const tokenAbi = []; // Replace with ABI of the token contract
  const tokenContract = new web3.eth.Contract(tokenAbi, smartContractAddress);

  // Approve token transfer
  const approveTx = tokenContract.methods.approve(smartContractAddress, sellAmount);

  const approveTxData = approveTx.encodeABI();
  const approveTxGas = await approveTx.estimateGas({ from: senderAddress });

  // Send approve transaction
  const approveTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: approveTxData,
      gas: approveTxGas,
    },
    config.privateKey
  );

  const approveTxReceipt = await web3.eth.sendSignedTransaction(approveTxSigned.rawTransaction);

  // Execute sell transaction
  const sellTx = tokenContract.methods.transferFrom(senderAddress, config.devAccount, sellAmount);

  const sellTxData = sellTx.encodeABI();
  const sellTxGas = await sellTx.estimateGas({ from: senderAddress });

  // Send sell transaction
  const sellTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: sellTxData,
      gas: sellTxGas,
    },
    config.privateKey
  );

  const sellTxReceipt = await web3.eth.sendSignedTransaction(sellTxSigned.rawTransaction);

  return `Sell TX: ${sellTxReceipt.transactionHash}`;
}

async function getBalance(ctx) {
  const address = web3.eth.accounts.privateKeyToAccount(config.privateKey).address;
  const smartContractAddress = 'SMART_CONTRACT_ADDRESS'; // Replace with actual contract address

  // Assuming the token has a standard ERC20 `balanceOf` function
  const tokenAbi = []; // Replace with ABI of the token contract
  const tokenContract = new web3.eth.Contract(tokenAbi, smartContractAddress);

  const balance = await tokenContract.methods.balanceOf(address).call();

  return balance;
}

bot.launch().then(() => {
  console.log('Bot is running...');
});
