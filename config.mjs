import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

export const config = {
  telegramApiKey: process.env.TELEGRAM_API_KEY,
  cronosRpcUrl: process.env.CRONOS_NODE_URL,
  privateKey: process.env.PRIVATE_KEY,
  devAccount: process.env.DEV_ACCOUNT_ADDRESS
};

console.log('Loaded Configuration:', config);
