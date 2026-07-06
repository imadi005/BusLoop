import fs from 'node:fs';
import path from 'node:path';

const app = process.argv[2] || 'app';
const problems = [];
const shellEnvKeys = new Set(Object.keys(process.env));

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!shellEnvKeys.has(key)) process.env[key] = value;
  });
};

const cwd = process.cwd();
const mode = process.env.MODE || process.env.NODE_ENV || 'production';
parseEnvFile(path.join(cwd, '.env'));
parseEnvFile(path.join(cwd, '.env.local'));
parseEnvFile(path.join(cwd, `.env.${mode}`));
parseEnvFile(path.join(cwd, `.env.${mode}.local`));

const isProd = process.env.NODE_ENV === 'production' || process.env.MODE === 'production' || mode === 'production';

const requireEnv = (name) => {
  if (!process.env[name]) problems.push(`${name} is missing`);
};

requireEnv('VITE_SUPABASE_URL');
requireEnv('VITE_SUPABASE_ANON_KEY');

if (app === 'user') requireEnv('VITE_RAZORPAY_KEY_ID');

if (isProd) {
  if (process.env.VITE_ENABLE_DEMO_MODE === 'true') problems.push('VITE_ENABLE_DEMO_MODE must be false in production');
  if (process.env.VITE_ALLOW_LOCAL_MOCKS === 'true') problems.push('VITE_ALLOW_LOCAL_MOCKS must be false in production');
  if (process.env.VITE_SHOW_DEMO_LOGIN === 'true') problems.push('VITE_SHOW_DEMO_LOGIN must be false in production');
  if (process.env.VITE_SHOW_DEMO_CREDENTIALS === 'true') problems.push('VITE_SHOW_DEMO_CREDENTIALS must be false in production');
  if (process.env.VITE_ALLOW_SIM_GPS === 'true') problems.push('VITE_ALLOW_SIM_GPS must be false in production');
}

if (problems.length) {
  console.error(`BusNOW ${app} release check failed:`);
  problems.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`BusNOW ${app} release check passed.`);
