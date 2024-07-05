import Web3 from 'web3';
import axios from 'axios';
import { Telegraf, Markup } from 'telegraf';
import { config } from './config.mjs';  // Import your config file

const { telegramApiKey, cronosRpcUrl, privateKey, devAccount } = config;

// Validate that the variables are loaded correctly
console.log('TELEGRAM_API_KEY:', telegramApiKey);
console.log('CRONOS_RPC_URL:', cronosRpcUrl);
console.log('DEV_ACCOUNT_ADDRESS:', devAccount);

const web3 = new Web3(new Web3.providers.HttpProvider(cronosRpcUrl));
const bot = new Telegraf(telegramApiKey);

let smartContractAddress = ''; // Initialize the smart contract address variable

const tokenAbi = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
    "name": "transfer",
    "outputs": [{"name": "success", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"name": "success", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "_from", "type": "address"}, {"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
    "name": "transferFrom",
    "outputs": [{"name": "success", "type": "bool"}],
    "type": "function"
  }
  // Add other ABI entries as needed
];

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

bot.action('buy', async (ctx) => {
  try {
    const transactionResult = await buyToken();
    ctx.reply(`Buy command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing buy command:', error);
    ctx.reply('Failed to execute buy command.');
  }
});

bot.action('sell', async (ctx) => {
  try {
    const transactionResult = await sellToken();
    ctx.reply(`Sell command executed successfully: ${transactionResult}`);
  } catch (error) {
    console.error('Error executing sell command:', error);
    ctx.reply('Failed to execute sell command.');
  }
});

bot.action('check_balance', async (ctx) => {
  try {
    const balance = await getBalance();
    ctx.reply(`Your current balance is: ${balance}`);
  } catch (error) {
    console.error('Error checking balance:', error);
    ctx.reply('Failed to check balance.');
  }
});

async function buyToken() {
  const senderAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address;
  const buyAmount = web3.utils.toWei('1', 'ether'); // Example buy amount
  const feePercentage = 0.005; // 0.5%
  const feeAmount = buyAmount * feePercentage;
  const actualBuyAmount = buyAmount - feeAmount;

  const tokenContract = new web3.eth.Contract(tokenAbi, smartContractAddress);

  const buyTx = tokenContract.methods.transfer(senderAddress, actualBuyAmount);
  const feeTx = tokenContract.methods.transfer(devAccount, feeAmount);

  const buyTxData = buyTx.encodeABI();
  const feeTxData = feeTx.encodeABI();

  const buyTxGas = await buyTx.estimateGas({ from: senderAddress });
  const feeTxGas = await feeTx.estimateGas({ from: senderAddress });

  const buyTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: buyTxData,
      gas: buyTxGas,
    },
    privateKey
  );

  const buyTxReceipt = await web3.eth.sendSignedTransaction(buyTxSigned.rawTransaction);

  const feeTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: feeTxData,
      gas: feeTxGas,
    },
    privateKey
  );

  const feeTxReceipt = await web3.eth.sendSignedTransaction(feeTxSigned.rawTransaction);

  return `Buy TX: ${buyTxReceipt.transactionHash}, Fee TX: ${feeTxReceipt.transactionHash}`;
}

async function sellToken() {
  const senderAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address;
  const sellAmount = web3.utils.toWei('1', 'ether'); // Example sell amount

  const tokenContract = new web3.eth.Contract(tokenAbi, smartContractAddress);

  const approveTx = tokenContract.methods.approve(smartContractAddress, sellAmount);

  const approveTxData = approveTx.encodeABI();
  const approveTxGas = await approveTx.estimateGas({ from: senderAddress });

  const approveTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: approveTxData,
      gas: approveTxGas,
    },
    privateKey
  );

  const approveTxReceipt = await web3.eth.sendSignedTransaction(approveTxSigned.rawTransaction);

  const sellTx = tokenContract.methods.transferFrom(senderAddress, devAccount, sellAmount);

  const sellTxData = sellTx.encodeABI();
  const sellTxGas = await sellTx.estimateGas({ from: senderAddress });

  const sellTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: sellTxData,
      gas: sellTxGas,
    },
    privateKey
  );

  const sellTxReceipt = await web3.eth.sendSignedTransaction(sellTxSigned.rawTransaction);

  return `Sell TX: ${sellTxReceipt.transactionHash}`;
}

async function getBalance() {
  const address = web3.eth.accounts.privateKeyToAccount(privateKey).address;

  const tokenContract = new web3.eth.Contract(tokenAbi, smartContractAddress);

  const balance = await tokenContract.methods.balanceOf(address).call();

  return balance;
}

bot.launch().then(() => {
  console.log('Bot is running...');
});
