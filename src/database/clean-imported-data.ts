// src/database/clean-imported-data.ts
import sqlite3 from 'sqlite3';
import path from 'path';
import readline from 'readline';

const dbPath = path.join(process.cwd(), 'poker.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to database\n');
});

async function cleanData() {
  console.log('=== CLEAN IMPORTED DATA ===\n');
  console.log('⚠️  WARNING: This will delete imported transaction data!\n');

  // Show current data
  await new Promise<void>((resolve) => {
    db.all(`
      SELECT 
        a.id,
        a.name,
        a.platform,
        COUNT(t.id) as transaction_count
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id
      GROUP BY a.id
    `, async (err, rows: any[]) => {
      if (err) {
        console.error('Error reading accounts:', err);
        resolve();
        return;
      }

      if (rows.length === 0) {
        console.log('No imported accounts found.\n');
        resolve();
        return;
      }

      console.log('Current imported accounts:');
      rows.forEach(row => {
        console.log(`  ${row.id}. ${row.name} (${row.platform}) - ${row.transaction_count} transactions`);
      });

      console.log('\nOptions:');
      console.log('  1. Delete specific account and its transactions');
      console.log('  2. Delete ALL imported data (accounts + transactions)');
      console.log('  3. Delete only transactions (keep accounts)');
      console.log('  4. Cancel\n');

      const choice = await question('Enter your choice (1-4): ');

      switch (choice) {
        case '1':
          const accountId = await question('Enter account ID to delete: ');
          await deleteAccount(parseInt(accountId));
          break;
        case '2':
          const confirmAll = await question('Are you sure you want to delete ALL imported data? (yes/no): ');
          if (confirmAll.toLowerCase() === 'yes') {
            await deleteAllData();
          } else {
            console.log('Cancelled.');
          }
          break;
        case '3':
          const confirmTrans = await question('Are you sure you want to delete all transactions? (yes/no): ');
          if (confirmTrans.toLowerCase() === 'yes') {
            await deleteAllTransactions();
          } else {
            console.log('Cancelled.');
          }
          break;
        default:
          console.log('Cancelled.');
      }
      
      resolve();
    });
  });

  rl.close();
  db.close();
}

function deleteAccount(accountId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\nDeleting account ${accountId} and its transactions...`);
    
    // First delete transactions
    db.run('DELETE FROM transactions WHERE account_id = ?', [accountId], function(err) {
      if (err) {
        console.error('Error deleting transactions:', err);
        reject(err);
        return;
      }
      
      const changes = this.changes;
      console.log(`✓ Deleted ${changes} transactions`);
      
      // Then delete account
      db.run('DELETE FROM accounts WHERE id = ?', [accountId], function(err) {
        if (err) {
          console.error('Error deleting account:', err);
          reject(err);
          return;
        }
        
        console.log(`✓ Deleted account\n`);
        resolve();
      });
    });
  });
}

function deleteAllData(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('\nDeleting all imported data...');
    
    // Delete all transactions first
    db.run('DELETE FROM transactions', function(err) {
      if (err) {
        console.error('Error deleting transactions:', err);
        reject(err);
        return;
      }
      
      const transChanges = this.changes;
      console.log(`✓ Deleted ${transChanges} transactions`);
      
      // Then delete all accounts
      db.run('DELETE FROM accounts', function(err) {
        if (err) {
          console.error('Error deleting accounts:', err);
          reject(err);
          return;
        }
        
        const accountChanges = this.changes;
        console.log(`✓ Deleted ${accountChanges} accounts\n`);
        resolve();
      });
    });
  });
}

function deleteAllTransactions(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('\nDeleting all transactions...');
    
    db.run('DELETE FROM transactions', function(err) {
      if (err) {
        console.error('Error deleting transactions:', err);
        reject(err);
        return;
      }
      
      const changes = this.changes;
      console.log(`✓ Deleted ${changes} transactions\n`);
      resolve();
    });
  });
}

cleanData().catch(console.error);