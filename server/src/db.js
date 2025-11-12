import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

let dbInstance = null;

function getDbPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '../data/email.db');
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!dbInstance) return reject(new Error('DB not initialized'));
    dbInstance.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    if (!dbInstance) return reject(new Error('DB not initialized'));
    dbInstance.exec(sql, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

export async function initDb() {
  if (dbInstance) return dbInstance;
  const dbPath = getDbPath();
  dbInstance = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });

  await exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return dbInstance;
}

export async function logEmail({ recipient, subject, content, status, errorMessage = null, attempts = 1 }) {
  await initDb();
  const ts = new Date().toISOString();
  await run(
    `INSERT INTO email_logs (recipient, subject, content, status, error_message, attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [recipient, subject, content || '', status, errorMessage, attempts, ts, ts]
  );
}