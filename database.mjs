import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function initializeDatabase() {
  const db = await open({
    filename: './database.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegramUserId INTEGER UNIQUE,
      cronosAddress TEXT,
      mnemonic TEXT
    )
  `);

  return db;
}

export { initializeDatabase };
