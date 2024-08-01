// config.mjs

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
  devAccount: process.env.DEV_ACCOUNT_ADDRESS,
  cronosExplorerApiKey: process.env.CRONOS_EXPLORER_API_KEY,
  cronosChainId: 25, // Mainnet Chain ID
  cronosSymbol: 'CRO',
  cronosExplorerUrl: 'https://cronos.org/explorer',
  tcronosRpcUrl: 'https://evm-t3.cronos.org',
  tcronosChainId: 338,
  tcronosSymbol: 'tCRO',
  tcronosExplorerUrl: 'https://explorer.cronos.org/testnet'
};
