// src/database/view-imported-data.ts
import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'poker.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to database\n');
});

async function viewData() {
  console.log('=== IMPORTED DATA SUMMARY ===\n');

  // 1. Check accounts
  await new Promise<void>((resolve) => {
    db.all('SELECT * FROM accounts', (err, rows: any[]) => {
      if (err) {
        console.error('Error reading accounts:', err);
      } else {
        console.log(`📁 Accounts (${rows.length}):`);
        rows.forEach(row => {
          console.log(`  - ID: ${row.id}, Name: ${row.name}, Platform: ${row.platform}`);
        });
      }
      console.log();
      resolve();
    });
  });

  // 2. Count transactions by account
  await new Promise<void>((resolve) => {
    db.all(`
      SELECT 
        a.name,
        a.platform,
        COUNT(t.id) as transaction_count,
        MIN(t.transaction_date) as first_transaction,
        MAX(t.transaction_date) as last_transaction,
        SUM(CASE WHEN t.is_external = 1 THEN t.amount ELSE 0 END) as real_money_total
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id
      GROUP BY a.id
    `, (err, rows: any[]) => {
      if (err) {
        console.error('Error reading transaction summary:', err);
      } else {
        console.log('📊 Transaction Summary by Account:');
        rows.forEach(row => {
          console.log(`\n  ${row.name} (${row.platform}):`);
          console.log(`    - Transactions: ${row.transaction_count}`);
          console.log(`    - Date Range: ${row.first_transaction || 'N/A'} to ${row.last_transaction || 'N/A'}`);
          console.log(`    - Real Money Balance: $${row.real_money_total || 0}`);
        });
      }
      console.log();
      resolve();
    });
  });

  // 3. Show transaction types breakdown
  await new Promise<void>((resolve) => {
    db.all(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM transactions
      GROUP BY type
      ORDER BY count DESC
    `, (err, rows: any[]) => {
      if (err) {
        console.error('Error reading transaction types:', err);
      } else {
        console.log('\n📈 Transaction Types:');
        rows.forEach(row => {
          console.log(`  - ${row.type}: ${row.count} transactions, Total: $${row.total_amount.toFixed(2)}`);
        });
      }
      console.log();
      resolve();
    });
  });

  // 4. Show recent transactions
  await new Promise<void>((resolve) => {
    db.all(`
      SELECT 
        t.transaction_date,
        t.type,
        t.amount,
        t.account_balance,
        a.name as account_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      ORDER BY t.transaction_date DESC
      LIMIT 10
    `, (err, rows: any[]) => {
      if (err) {
        console.error('Error reading recent transactions:', err);
      } else {
        console.log('\n📅 10 Most Recent Transactions:');
        rows.forEach(row => {
          const date = new Date(row.transaction_date).toLocaleString();
          console.log(`  ${date} - ${row.type}: $${row.amount} (Balance: $${row.account_balance}) [${row.account_name}]`);
        });
      }
      resolve();
    });
  });

  console.log('\n✅ Data view complete\n');
  
  db.close();
}

viewData().catch(console.error);