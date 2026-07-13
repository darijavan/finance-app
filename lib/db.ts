import { DatabaseSync } from "node:sqlite";
import * as fs from "fs";
import * as path from "path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "finance.db");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  initSchema(db);
  seedDefaults(db);
  _db = db;
  return db;
}

function run(db: DatabaseSync, sql: string, params: any[] = []) {
  db.prepare(sql).run(...params);
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      color     TEXT NOT NULL DEFAULT '#7c9cff',
      direction TEXT NOT NULL DEFAULT 'expense'
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL NOT NULL,
      direction   TEXT NOT NULL,
      category_id INTEGER,
      date        TEXT NOT NULL,
      note        TEXT DEFAULT '',
      created_at  TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      amount        REAL NOT NULL,
      direction     TEXT NOT NULL DEFAULT 'expense',
      category_id   INTEGER,
      frequency     TEXT NOT NULL DEFAULT 'monthly',
      day_of_month  INTEGER NOT NULL DEFAULT 1,
      month_of_year INTEGER,
      active        INTEGER NOT NULL DEFAULT 1,
      note          TEXT DEFAULT '',
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      month       TEXT NOT NULL,
      amount      REAL NOT NULL,
      UNIQUE(category_id, month),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
  `);
}

function seedDefaults(db: DatabaseSync) {
  const catCount = (db.prepare("SELECT COUNT(*) AS c FROM categories").get() as any).c;
  if (catCount === 0) {
    const expense = [
      ["Food", "#ff7c7c"], ["Transport", "#ffb86c"], ["Housing", "#8be9fd"],
      ["Utilities", "#bd93f9"], ["Subscriptions", "#ff79c6"], ["Health", "#50fa7b"],
      ["Entertainment", "#f1fa8c"], ["Shopping", "#ff92df"], ["Other", "#7c9cff"],
    ];
    const income = [
      ["Allowance", "#50fa7b"], ["Salary", "#8be9fd"], ["Gifts", "#f1fa8c"], ["Other income", "#7c9cff"],
    ];
    const ins = db.prepare("INSERT INTO categories(name,color,direction) VALUES(?,?,?)");
    for (const [n, c] of expense) ins.run(n, c, "expense");
    for (const [n, c] of income) ins.run(n, c, "income");
  }
  const setCount = (db.prepare("SELECT COUNT(*) AS c FROM settings").get() as any).c;
  if (setCount === 0) {
    run(db, "INSERT INTO settings(key,value) VALUES(?,?)", ["currency", "ILS"]);
    run(db, "INSERT INTO settings(key,value) VALUES(?,?)", ["currency_symbol", "₪"]);
  }
}
