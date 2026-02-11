import fs from 'fs';
import path from 'path';

function getDataDir(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

export function readJsonObject<T extends Record<string, unknown>>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(getDataDir(), filename);
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to read JSON object ${filename}:`, error);
    return fallback;
  }
}

export function writeJsonObject<T extends Record<string, unknown>>(filename: string, value: T): void {
  const filePath = path.join(getDataDir(), filename);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

