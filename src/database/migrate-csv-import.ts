// src/database/migrate-csv-import.ts
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'poker.db');

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

const migrations = [
  // Check and add platform column
  `CREATE TABLE IF NOT EXISTS accounts_temp AS SELECT * FROM accounts`,
  `DROP TABLE IF EXISTS accounts_temp`,
  
  // Add columns to transactions if they don't exist
  `ALTER TABLE transactions ADD COLUMN account_balance DECIMAL(10,2)`,
  `ALTER TABLE transactions ADD COLUMN real_money_balance DECIMAL(10,2)`,
  `ALTER TABLE transactions ADD COLUMN is_external INTEGER DEFAULT 0`,
  `ALTER TABLE transactions ADD COLUMN imported_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
  
  // Create index
  `CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_check 
   ON transactions(account_id, transaction_date, type, amount)`,
  
  // Create transaction_types table
  `CREATE TABLE IF NOT EXISTS transaction_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK(category IN ('external', 'internal')),
    is_deposit INTEGER DEFAULT 0,
    is_withdrawal INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Insert transaction types
  `INSERT OR IGNORE INTO transaction_types (name, category, is_deposit, is_withdrawal) VALUES
    ('Purchase - Credit Card', 'external', 1, 0),
    ('Redemption', 'external', 0, 1),
    ('Tournament Registration', 'internal', 0, 0),
    ('Tournament Payout', 'internal', 0, 0),
    ('Tournament Re-buy', 'internal', 0, 0),
    ('Tournament Add-on', 'internal', 0, 0),
    ('Tournament Bounty', 'internal', 0, 0),
    ('Tournament Unregistration', 'internal', 0, 0),
    ('Daily Bonus', 'internal', 0, 0),
    ('Daily Bonus Boost', 'internal', 0, 0),
    ('Prize Draw', 'internal', 0, 0),
    ('Vault Bonus Claim', 'internal', 0, 0)`,
  
  // Create view
  `CREATE VIEW IF NOT EXISTS account_real_money_balance AS
   SELECT 
     a.id as account_id,
     a.name as account_name,
     a.platform,
     COALESCE(SUM(CASE WHEN t.is_external = 1 THEN t.amount ELSE 0 END), 0) as real_money_balance,
     COALESCE(SUM(t.amount), 0) as total_balance,
     COUNT(t.id) as transaction_count,
     MAX(t.transaction_date) as last_transaction_date
   FROM accounts a
   LEFT JOIN transactions t ON a.id = t.account_id
   GROUP BY a.id`
];

// Function to check if column exists
function columnExists(table: string, column: string): Promise<boolean> {
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows: any[]) => {
      if (err) {
        console.error(`Error checking columns for ${table}:`, err);
        resolve(false);
      } else {
        const exists = rows.some(row => row.name === column);
        resolve(exists);
      }
    });
  });
}

// Run migrations
async function runMigrations() {
  console.log('Starting migrations...');
  
  // First check if accounts table needs platform column
  const hasPlatform = await columnExists('accounts', 'platform');
  if (!hasPlatform) {
    console.log('Adding platform column to accounts...');
    db.run(`ALTER TABLE accounts ADD COLUMN platform TEXT DEFAULT 'Manual'`, (err) => {
      if (err) console.error('Error adding platform column:', err);
      else console.log('Added platform column');
    });
  }
  
  // Run each migration
  for (const migration of migrations) {
    await new Promise<void>((resolve) => {
      db.run(migration, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Migration error:', err);
        }
        resolve();
      });
    });
  }
  
  console.log('Migrations completed');
  
  // Close database
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
}

runMigrations().catch(console.error);