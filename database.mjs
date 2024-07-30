import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

// Initialize and open the database connection
async function initializeDatabase() {
  const db = await open({
    filename: './database.db',
    driver: sqlite3.Database,
    verbose: console.log // Optional: log SQL queries for debugging
  });

  // Enable encryption
  await db.exec(`PRAGMA key = '${process.env.DB_ENCRYPTION_KEY}'`);

  // Ensure tables are set up correctly
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegramUserId INTEGER UNIQUE,
      cronosAddress TEXT,
      mnemonic TEXT
    );
  `);

  return db;
}

// Fetch user's Cronos address by their Telegram user ID
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

// Save or update user's Cronos address and mnemonic
async function saveUserCronosAddress(userId, cronosAddress, mnemonic) {
  const db = await initializeDatabase();
  try {
    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE telegramUserId = ?', [userId]);
    if (existingUser) {
      // Update existing user
      await db.run('UPDATE users SET cronosAddress = ?, mnemonic = ? WHERE telegramUserId = ?', [cronosAddress, mnemonic, userId]);
    } else {
      // Insert new user
      await db.run('INSERT INTO users (telegramUserId, cronosAddress, mnemonic) VALUES (?, ?, ?)', [userId, cronosAddress, mnemonic]);
    }
  } catch (error) {
    console.error('Failed to save or update user data:', error);
  }
}

export { initializeDatabase, getAddressByUserId, saveUserCronosAddress };
