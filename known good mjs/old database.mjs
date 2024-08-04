import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

export async function initializeDatabase() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegramUserId INTEGER UNIQUE,
      cronosAddress TEXT,
      mnemonic TEXT
    )
  `);

  return db;
}

export async function getAddressByUserId(userId) {
  const user = await db.get('SELECT cronosAddress FROM users WHERE telegramUserId = ?', [userId]);
  return user ? user.cronosAddress : null;
}

export async function saveUserCronosAddress(userId, address, mnemonic) {
  await db.run(
    'INSERT INTO users (telegramUserId, cronosAddress, mnemonic) VALUES (?, ?, ?)',
    [userId, address, mnemonic]
  );
}

export async function updateUserCronosAddress(userId, address, mnemonic) {
  const existingUser = await db.get('SELECT * FROM users WHERE telegramUserId = ?', [userId]);
  if (existingUser) {
    await db.run(
      'UPDATE users SET cronosAddress = ?, mnemonic = ? WHERE telegramUserId = ?',
      [address, mnemonic, userId]
    );
  } else {
    await saveUserCronosAddress(userId, address, mnemonic);
  }
}
