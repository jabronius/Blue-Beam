import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Resolve current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Export configuration constants
export const config = {
  telegramApiKey: process.env.TELEGRAM_API_KEY,
  cronosRpcUrl: process.env.CRONOS_NODE_URL,
  privateKey: process.env.PRIVATE_KEY,
  devAccount: process.env.DEV_ACCOUNT_ADDRESS
};
