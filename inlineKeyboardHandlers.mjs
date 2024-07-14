import Web3 from 'web3';
import { config } from './config.mjs';
import { Markup } from 'telegraf';

const web3 = new Web3(new Web3.providers.HttpProvider(config.cronosRpcUrl));
let smartContractAddress = '';

// Function to handle the start command
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
    ctx.reply('Please send your private key to imptor your Cronos Chain wallet.');
    // Listen for the next message containing the private key
    ctx.telegram.on('message', async (messageCtx) => {
      const privateKey = messageCtx.message.text;
      try {
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        // Store the imported private key securely
        // e.g., store in database or a secure variable
        ctx.reply(`Wallet imported successfully! Address: ${account.address}`);
        displayOpenPositionsMenu(ctx);
      } catch (error) {
        ctx.reply('Invalid private key. Please try again.');
      }
    });
  }

  if (action === 'create_wallet') {
    const account = web3.eth.accounts.create();
    // Store the newly created private key securely
    // e.g., store in database or a secure variable
    ctx.reply(`New wallet created successfully! Address: ${account.address}\nPrivate Key: ${account.privateKey}`);
    displayOpenPositionsMenu(ctx);
  }

  if (action === 'enter_contract') {
    ctx.reply('Please send the token contract address.');
    // Listen for the next message containing the contract address
    ctx.telegram.on('message', async (messageCtx) => {
      smartContractAddress = messageCtx.message.text;
      ctx.reply(
        'Contract address received. Please choose an option:',
        Markup.inlineKeyboard([
          Markup.button.callback('Buy 1000 CRO', 'buy_1000_cro'),
          Markup.button.callback('Buy Custom Amount', 'buy_custom_amount')
        ])
      );
    });
  }

  if (action === 'buy_1000_cro') {
    try {
      const transactionResult = await buyToken(ctx, 1000);
      ctx.reply(`Buy command executed successfully: ${transactionResult}`);
    } catch (error) {
      console.error('Error executing buy command:', error);
      ctx.reply('Failed to execute buy command.');
    }
  }

  if (action === 'buy_custom_amount') {
    ctx.reply('Please enter the amount of CRO you want to buy.');
    ctx.telegram.on('message', async (messageCtx) => {
      const amount = parseFloat(messageCtx.message.text);
      try {
        const transactionResult = await buyToken(ctx, amount);
        ctx.reply(`Buy command executed successfully: ${transactionResult}`);
      } catch (error) {
        console.error('Error executing buy command:', error);
        ctx.reply('Failed to execute buy command.');
      }
    });
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

function displayOpenPositionsMenu(ctx) {
  ctx.reply(
    'Open Positions Menu:',
    Markup.inlineKeyboard([
      Markup.button.callback('Paste Token Address', 'enter_contract')
    ])
  );
}

async function buyToken(ctx, amount) {
  const senderAddress = web3.eth.accounts.privateKeyToAccount(config.privateKey).address;
  const buyAmount = web3.utils.toWei(amount.toString(), 'ether'); // Example buy amount
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
  const sellAmount = web3.utils.toWei('1', 'ether'); // Example sell amount
  const taxPercentage = 0.0025; // 0.25%

  // Calculate tax amount
  const taxAmount = sellAmount * taxPercentage;
  const amountAfterTax = sellAmount - taxAmount;

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

  // Send tax transaction
  const taxTx = tokenContract.methods.transferFrom(senderAddress, config.devAccount, taxAmount);
  const taxTxData = taxTx.encodeABI();
  const taxTxGas = await taxTx.estimateGas({ from: senderAddress });
  const taxTxSigned = await web3.eth.accounts.signTransaction(
    {
      to: smartContractAddress,
      data: taxTxData,
      gas: taxTxGas,
    },
    config.privateKey
  );
  const taxTxReceipt = await web3.eth.sendSignedTransaction(taxTxSigned.rawTransaction);

  // Execute sell transaction
  const sellTx = tokenContract.methods.transferFrom(senderAddress, smartContractAddress, amountAfterTax);
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

  // Assuming the token has a standard ERC20 `balanceOf` function
  const tokenAbi = []; // Replace with ABI of the token contract
  const tokenContract = new web3.eth.Contract(tokenAbi, smartContractAddress);

  const balance = await tokenContract.methods.balanceOf(address).call();
  return web3.utils.fromWei(balance, 'ether');
}
