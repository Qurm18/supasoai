// lib/logger.ts
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  debug: (msg: string, ...data: any[]) => {
    if (isDev) {
      console.log(`[DEBUG] ${msg}`, ...data);
    }
  },
  info: (msg: string, ...data: any[]) => {
    if (isDev) {
      console.info(`[INFO] ${msg}`, ...data);
    }
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(`[WARN] ${msg}`, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    console.error(`[ERROR] ${msg}`, ...args);
  }
};
