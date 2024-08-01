import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';
import Web3 from 'web3';
import { fetchTokenABI, getTokenInfo } from './handlers.mjs';

dotenv.config();

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.CRONOS_NODE_URL));

async function initializeDatabase() {
  const db = await open({
    filename: './database.db',
    driver: sqlite3.Database,
    verbose: console.log
  });

  await db.exec(`PRAGMA key = '${process.env.DB_ENCRYPTION_KEY}'`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegramUserId INTEGER UNIQUE,
      cronosAddress TEXT,
      mnemonic TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS open_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegramUserId INTEGER,
      tokenAddress TEXT,
      balance REAL,
      valueUSD REAL,
      lastUpdated DATETIME,
      FOREIGN KEY (telegramUserId) REFERENCES users (telegramUserId)
    );
  `);

  return db;
}

async function fetchTokenBalance(tokenAddress, userId) {
  const userAddress = await getAddressByUserId(userId);
  const balance = await web3.eth.getBalance(userAddress); // Fetch CRO balance directly
  return web3.utils.fromWei(balance, 'ether');
}

async function saveTradeData(userId, tokenAddress, amountInCRO) {
  const db = await initializeDatabase();
  try {
    const balance = await fetchTokenBalance(tokenAddress, userId); // Updated to fetch balance directly
    const valueUSD = balance * await getTokenUSDValue(tokenAddress); // Assuming getTokenUSDValue fetches the USD value of CRO

    const existingToken = await db.get('SELECT id FROM open_positions WHERE telegramUserId = ? AND tokenAddress = ?', [userId, tokenAddress]);

    if (existingToken) {
      await db.run('UPDATE open_positions SET balance = ?, valueUSD = ?, lastUpdated = ? WHERE id = ?', [balance, valueUSD, new Date(), existingToken.id]);
    } else {
      await db.run('INSERT INTO open_positions (telegramUserId, tokenAddress, balance, valueUSD, lastUpdated) VALUES (?, ?, ?, ?, ?)', [userId, tokenAddress, balance, valueUSD, new Date()]);
    }
  } catch (error) {
    console.error('Failed to save trade data:', error);
  }
}

async function getAddressByUserId(userId) {
  const db = await initializeDatabase();
  try {
    const user = await db.get('SELECT cronosAddress FROM users WHERE telegramUserId = ?', [userId]);
    return user ? user.cronosAddress : null;
  } catch (error) {
    console.error('Failed to fetch user address:', error);
    return null;
  }
}

async function saveUserCronosAddress(userId, cronosAddress, mnemonic) {
  const db = await initializeDatabase();
  try {
    const existingUser = await db.get('SELECT id FROM users WHERE telegramUserId = ?', [userId]);
    if (existingUser) {
      await db.run('UPDATE users SET cronosAddress = ?, mnemonic = ? WHERE telegramUserId = ?', [cronosAddress, mnemonic, userId]);
    } else {
      await db.run('INSERT INTO users (telegramUserId, cronosAddress, mnemonic) VALUES (?, ?, ?)', [userId, cronosAddress, mnemonic]);
    }
  } catch (error) {
    console.error('Failed to save or update user data:', error);
  }
}

export { initializeDatabase, getAddressByUserId, saveUserCronosAddress, fetchTokenBalance, saveTradeData };
