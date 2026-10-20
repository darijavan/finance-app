import { DatabaseSync } from "node:sqlite";
import * as fs from "fs";
import * as path from "path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "finance.db");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) 

  return _db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  initSchema(db);
  migrate(db);
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
      currency    TEXT NOT NULL DEFAULT 'ILS',
      direction   TEXT NOT NULL,
      category_id INTEGER,
      date        TEXT NOT NULL,
      note        TEXT DEFAULT '',
      account_id  INTEGER,
      account_amount REAL,
      account_currency TEXT,
      account_fx_rate REAL,
      account_fx_date TEXT,
      account_fx_source TEXT,
      subscription_id INTEGER,
      reimbursable INTEGER NOT NULL DEFAULT 0,
      reimbursed_at TEXT,
      receipt_key TEXT,
      receipt_name TEXT,
      receipt_mime TEXT,
      created_at  TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      amount        REAL NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'ILS',
      direction     TEXT NOT NULL DEFAULT 'expense',
      category_id   INTEGER,
      frequency     TEXT NOT NULL DEFAULT 'monthly',
      day_of_month  INTEGER NOT NULL DEFAULT 1,
      month_of_year INTEGER,
      active        INTEGER NOT NULL DEFAULT 1,
      note          TEXT DEFAULT '',
      start_date    TEXT DEFAULT NULL,        -- when the subscription began (YYYY-MM-DD)
      account_id    INTEGER,                  -- which account it's charged from
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      type      TEXT NOT NULL DEFAULT 'bank',   -- 'bank' | 'cash' | 'card' | 'other'
      currency  TEXT NOT NULL DEFAULT 'ILS',
      active    INTEGER NOT NULL DEFAULT 1,
      note      TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      amount        REAL NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'ILS',
      from_account  INTEGER NOT NULL,
      to_account    INTEGER NOT NULL,
      date          TEXT NOT NULL,
      note          TEXT DEFAULT '',
      from_amount   REAL,
      from_currency TEXT,
      to_amount     REAL,
      to_currency   TEXT,
      from_fx_rate  REAL,
      to_fx_rate    REAL,
      fx_rate_date  TEXT,
      fx_source     TEXT,
      created_at    TEXT NOT NULL,
      FOREIGN KEY (from_account) REFERENCES accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (to_account) REFERENCES accounts(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      month       TEXT NOT NULL,
      amount      REAL NOT NULL,
      UNIQUE(category_id, month),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS fx_rates (
      code       TEXT PRIMARY KEY,
      rate       REAL NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fx_daily_rates (
      requested_date TEXT NOT NULL,
      base_currency  TEXT NOT NULL,
      quote_currency TEXT NOT NULL,
      rate           REAL NOT NULL,
      rate_date      TEXT NOT NULL,
      source         TEXT NOT NULL,
      retrieved_at   TEXT NOT NULL,
      PRIMARY KEY (requested_date, base_currency, quote_currency)
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE TABLE IF NOT EXISTS goals (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      target_amount REAL NOT NULL,
      account_id    INTEGER NOT NULL,          -- progress = this account's native balance
      target_date   TEXT,                      -- optional YYYY-MM-DD
      note          TEXT DEFAULT '',
      created_at    TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity      TEXT NOT NULL,              -- 'transaction' | 'subscription' | 'budget' | 'category'
      action      TEXT NOT NULL,              -- 'create' | 'update' | 'delete'
      entity_id   INTEGER,                    -- id of the affected row (null after delete)
      summary     TEXT NOT NULL DEFAULT '',   -- human-readable one-liner for the UI
      payload     TEXT,                       -- JSON snapshot needed to undo a delete
      created_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS statement_imports (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      source             TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL UNIQUE,
      account_id         INTEGER NOT NULL,
      currency           TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'draft',
      created_at         TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS statement_import_rows (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id              INTEGER NOT NULL,
      row_index              INTEGER NOT NULL,
      date                   TEXT NOT NULL,
      amount                 REAL NOT NULL,
      direction              TEXT NOT NULL,
      note                   TEXT NOT NULL DEFAULT '',
      status                 TEXT NOT NULL,
      matched_transaction_id INTEGER,
      created_at             TEXT NOT NULL,
      FOREIGN KEY (import_id) REFERENCES statement_imports(id) ON DELETE CASCADE,
      FOREIGN KEY (matched_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
      UNIQUE(import_id, row_index)
    );
  `);
}

// Append an entry to the activity log. Returns the new row id.
// `payload` is an optional JSON string; for deletes it should hold a snapshot
// of the deleted row so the action can be reversed via undoActivity().
export function logActivity(
  db: DatabaseSync,
  entity: string,
  action: "create" | "update" | "delete",
  entity_id: number | null,
  summary: string,
  payload?: unknown,
): number {
  const info = db.prepare(
    `INSERT INTO activity_log(entity, action, entity_id, summary, payload, created_at)
     VALUES(?,?,?,?,?,?)`,
  ).run(
    entity,
    action,
    entity_id,
    summary,
    payload === undefined ? null : JSON.stringify(payload),
    new Date().toISOString(),
  );
  
  return Number(info.lastInsertRowid);
}

// Reverse a logged action. Only deletions are reversible (they carry a
// snapshot payload). Returns the restored row id, or null if not undoable.
export function undoActivity(
  db: DatabaseSync,
  logId: number,
): number | null {
  const row = db.prepare("SELECT * FROM activity_log WHERE id=?").get(logId) as any;
  if (!row || row.action !== "delete" || !row.payload) 

  return null;
  const data = JSON.parse(row.payload);
  if (!data || typeof data !== "object" || !data.table) 

  return null;

  const cols = Object.keys(data).filter((k) => k !== "table");
  const placeholders = cols.map(() => "?").join(", ");
  const values = cols.map((k) => data[k]);
  db.prepare(
    `INSERT INTO ${data.table} (${cols.join(", ")}) VALUES (${placeholders})`,
  ).run(...values);

  // Mark the log entry as undone so it can't be re-applied.
  db.prepare("UPDATE activity_log SET action='delete-undone' WHERE id=?").run(logId);
  
  return Number((db.prepare("SELECT last_insert_rowid() AS id").get() as any).id);
}

// Additive column migrations for pre-existing databases.
function migrate(db: DatabaseSync) {
  const cols = (table: string): string[] =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((r) => r.name);
  if (!cols("transactions").includes("currency")) {
    db.exec("ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'ILS'");
  }
  if (!cols("subscriptions").includes("currency")) {
    db.exec("ALTER TABLE subscriptions ADD COLUMN currency TEXT NOT NULL DEFAULT 'ILS'");
  }
  if (!cols("subscriptions").includes("start_date")) {
    db.exec("ALTER TABLE subscriptions ADD COLUMN start_date TEXT DEFAULT NULL");
  }
  if (!cols("transactions").includes("account_id")) {
    db.exec("ALTER TABLE transactions ADD COLUMN account_id INTEGER");
  }
  if (!cols("transactions").includes("subscription_id")) {
    db.exec("ALTER TABLE transactions ADD COLUMN subscription_id INTEGER");
  }
  for (const column of [
    "account_amount REAL", "account_currency TEXT", "account_fx_rate REAL",
    "account_fx_date TEXT", "account_fx_source TEXT", "reimbursable INTEGER NOT NULL DEFAULT 0",
    "reimbursed_at TEXT", "receipt_key TEXT", "receipt_name TEXT", "receipt_mime TEXT",
  ]) {
    if (!cols("transactions").includes(column.split(" ")[0])) {
      db.exec(`ALTER TABLE transactions ADD COLUMN ${column}`);
    }
  }
  if (!cols("subscriptions").includes("account_id")) {
    db.exec("ALTER TABLE subscriptions ADD COLUMN account_id INTEGER");
  }
  for (const column of [
    "from_amount REAL", "from_currency TEXT", "to_amount REAL", "to_currency TEXT",
    "from_fx_rate REAL", "to_fx_rate REAL", "fx_rate_date TEXT", "fx_source TEXT",
  ]) {
    if (!cols("transfers").includes(column.split(" ")[0])) {
      db.exec(`ALTER TABLE transfers ADD COLUMN ${column}`);
    }
  }
  if (!cols("budgets").includes("rollover")) {
    db.exec("ALTER TABLE budgets ADD COLUMN rollover INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols("accounts").includes("sort_order")) {
    db.exec("ALTER TABLE accounts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE accounts SET sort_order = id WHERE sort_order = 0");
  }
  // After the column adds above, so they also work on databases created before those columns.
  db.exec("CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id)");
  // Link legacy automatic charges to their source subscription before enforcing idempotency.
  // Matching the generated note *and* scheduled day prevents accidental links to manual rows.
  db.exec(`UPDATE transactions
    SET subscription_id = (
      SELECT s.id FROM subscriptions AS s
      WHERE transactions.note = '[auto] ' || s.name || ' (' || s.frequency || ')'
        AND CAST(substr(transactions.date, 9, 2) AS INTEGER) = MIN(COALESCE(s.day_of_month, 1), 28)
        AND (s.frequency = 'monthly' OR (
          s.frequency = 'yearly' AND CAST(substr(transactions.date, 6, 2) AS INTEGER) = s.month_of_year
        ))
      LIMIT 1
    )
    WHERE subscription_id IS NULL AND note LIKE '[auto] %'`);
  // A subscription may have only one linked charge per calendar month. This also
  // prevents an automatic due-date entry after an imported statement posts later.
  db.exec("DROP INDEX IF EXISTS idx_auto_subscription_charge");
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_subscription_charge
    ON transactions(subscription_id, substr(date, 1, 7)) WHERE subscription_id IS NOT NULL`);
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
  // Seed a default "Bank" account on first run so transfers/balances have somewhere to start.
  const accCount = (db.prepare("SELECT COUNT(*) AS c FROM accounts").get() as any).c;
  if (accCount === 0) {
    run(db, "INSERT INTO accounts(name,type,currency) VALUES(?,?,?)", ["Bank", "bank", "ILS"]);
  }
}
