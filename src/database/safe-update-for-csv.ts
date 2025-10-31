// src/database/safe-update-for-csv.ts
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'poker.db');

// First, create a backup
const backupPath = path.join(process.cwd(), `poker-backup-${Date.now()}.db`);

console.log('Creating database backup...');
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✓ Backup created at: ${backupPath}`);
} catch (error) {
  console.error('✗ Failed to create backup:', error);
  process.exit(1);
}

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('✗ Error opening database:', err);
    process.exit(1);
  }
  console.log('✓ Connected to database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Function to check if table exists
function tableExists(tableName: string): Promise<boolean> {
  return new Promise((resolve) => {
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName],
      (err, rows) => {
        if (err) {
          console.error(`Error checking for table ${tableName}:`, err);
          resolve(false);
        } else {
          resolve(rows.length > 0);
        }
      }
    );
  });
}

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

// Function to run a query safely
function runQuery(sql: string, description: string): Promise<void> {
  return new Promise((resolve) => {
    db.run(sql, (err) => {
      if (err) {
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate column name')) {
          console.log(`  ℹ ${description} - already exists (skipped)`);
        } else {
          console.error(`  ✗ ${description} - Error:`, err.message);
        }
      } else {
        console.log(`  ✓ ${description} - completed`);
      }
      resolve();
    });
  });
}

async function updateDatabase() {
  console.log('\nStarting database update...\n');

  // 1. Create accounts table if it doesn't exist
  console.log('1. Checking accounts table...');
  const hasAccountsTable = await tableExists('accounts');
  if (!hasAccountsTable) {
    await runQuery(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        platform TEXT DEFAULT 'Manual',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, 'Create accounts table');
  } else {
    console.log('  ℹ accounts table already exists');
    
    // Check if platform column exists
    const hasPlatform = await columnExists('accounts', 'platform');
    if (!hasPlatform) {
      await runQuery(
        `ALTER TABLE accounts ADD COLUMN platform TEXT DEFAULT 'Manual'`,
        'Add platform column to accounts'
      );
    }
  }

  // 2. Create transactions table if it doesn't exist
  console.log('\n2. Checking transactions table...');
  const hasTransactionsTable = await tableExists('transactions');
  if (!hasTransactionsTable) {
    await runQuery(`
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        transaction_date DATETIME NOT NULL,
        type TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        account_balance DECIMAL(10,2),
        real_money_balance DECIMAL(10,2),
        description TEXT,
        is_external INTEGER DEFAULT 0,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `, 'Create transactions table');
  } else {
    console.log('  ℹ transactions table already exists');
    
    // Check for new columns
    const columnsToCheck = [
      'account_balance',
      'real_money_balance',
      'is_external',
      'imported_at'
    ];
    
    for (const column of columnsToCheck) {
      const hasColumn = await columnExists('transactions', column);
      if (!hasColumn) {
        let columnDef = '';
        switch (column) {
          case 'account_balance':
          case 'real_money_balance':
            columnDef = `${column} DECIMAL(10,2)`;
            break;
          case 'is_external':
            columnDef = `${column} INTEGER DEFAULT 0`;
            break;
          case 'imported_at':
            columnDef = `${column} DATETIME DEFAULT CURRENT_TIMESTAMP`;
            break;
        }
        await runQuery(
          `ALTER TABLE transactions ADD COLUMN ${columnDef}`,
          `Add ${column} column to transactions`
        );
      }
    }
  }

  // 3. Create transaction_types table
  console.log('\n3. Checking transaction_types table...');
  const hasTransactionTypesTable = await tableExists('transaction_types');
  if (!hasTransactionTypesTable) {
    await runQuery(`
      CREATE TABLE transaction_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL CHECK(category IN ('external', 'internal')),
        is_deposit INTEGER DEFAULT 0,
        is_withdrawal INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, 'Create transaction_types table');

    // Insert default transaction types
    console.log('\n4. Inserting transaction types...');
    const transactionTypes = [
      // External transactions
      ['Purchase - Credit Card', 'external', 1, 0],
      ['Redemption', 'external', 0, 1],
      // Internal transactions
      ['Tournament Registration', 'internal', 0, 0],
      ['Tournament Payout', 'internal', 0, 0],
      ['Tournament Re-buy', 'internal', 0, 0],
      ['Tournament Add-on', 'internal', 0, 0],
      ['Tournament Bounty', 'internal', 0, 0],
      ['Tournament Unregistration', 'internal', 0, 0],
      ['Daily Bonus', 'internal', 0, 0],
      ['Daily Bonus Boost', 'internal', 0, 0],
      ['Prize Draw', 'internal', 0, 0],
      ['Vault Bonus Claim', 'internal', 0, 0]
    ];

    for (const [name, category, isDeposit, isWithdrawal] of transactionTypes) {
      await runQuery(
        `INSERT OR IGNORE INTO transaction_types (name, category, is_deposit, is_withdrawal) 
         VALUES ('${name}', '${category}', ${isDeposit}, ${isWithdrawal})`,
        `Insert transaction type: ${name}`
      );
    }
  } else {
    console.log('  ℹ transaction_types table already exists');
  }

  // 4. Create index for duplicate detection
  console.log('\n5. Creating indexes...');
  await runQuery(
    `CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_check 
     ON transactions(account_id, transaction_date, type, amount, account_balance)`,
    'Create duplicate check index'
  );

  // 5. Create view for real money balance
  console.log('\n6. Creating views...');
  await runQuery(
    `DROP VIEW IF EXISTS account_real_money_balance`,
    'Drop existing view (if any)'
  );
  
  await runQuery(
    `CREATE VIEW account_real_money_balance AS
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
     GROUP BY a.id`,
    'Create account_real_money_balance view'
  );

  console.log('\n✅ Database update completed successfully!');
  console.log(`\n📁 Backup saved at: ${backupPath}`);
  console.log('💡 If anything went wrong, you can restore from the backup\n');

  // Close database
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
}

// Run the update
updateDatabase().catch(console.error);