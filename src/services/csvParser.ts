// src/services/csvParser.ts
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import { Database } from 'sqlite3';

export interface GlobalPokerTransaction {
  date: Date;
  type: string;
  amount: number;
  balance: number;
  description?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export class CsvParserService {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Parse Global Poker CSV date format
   * Example: "06/13/25, 4:58 PM CDT"
   */
  private parseDate(dateStr: string): Date {
    // Remove timezone abbreviation
    const cleanDate = dateStr.replace(/\s+[A-Z]{3}$/, '');
    
    // Parse the date
    const [datePart, timePart] = cleanDate.split(', ');
    const [month, day, year] = datePart.split('/');
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    
    // Combine date and time
    const dateTimeStr = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`;
    
    return new Date(dateTimeStr);
  }

  /**
   * Determine if a transaction type affects real money balance
   */
  private isExternalTransaction(type: string): boolean {
    const externalTypes = ['Purchase - Credit Card', 'Redemption'];
    return externalTypes.includes(type);
  }

  /**
   * Parse Global Poker CSV file
   */
  async parseGlobalPokerCsv(filePath: string): Promise<GlobalPokerTransaction[]> {
    return new Promise((resolve, reject) => {
      const transactions: GlobalPokerTransaction[] = [];
      
      fs.createReadStream(filePath)
        .pipe(parse({
          columns: false,
          skip_empty_lines: true,
          trim: true,
          quote: '"',
          relax_quotes: true,
          relax_column_count: true
        }))
        .on('data', (row) => {
          try {
            // Skip header row if present
            if (row[0] === 'Date' || row[0] === '"Date"') {
              console.log('Skipping header row');
              return;
            }
            
            // Global Poker CSV format: Date, Type, Amount, Balance
            if (row.length >= 4) {
              // Remove quotes if present
              const cleanRow = row.map((field: string) => {
                if (typeof field === 'string') {
                  return field.replace(/^"|"$/g, '').trim();
                }
                return field;
              });
              
              const transaction: GlobalPokerTransaction = {
                date: this.parseDate(cleanRow[0]),
                type: cleanRow[1],
                amount: parseFloat(cleanRow[2]),
                balance: parseFloat(cleanRow[3]),
                description: cleanRow[1] // Use type as description for now
              };
              transactions.push(transaction);
            } else {
              console.log('Row has insufficient columns:', row.length, row);
            }
          } catch (error) {
            console.error('Error parsing row:', error, row);
          }
        })
        .on('error', reject)
        .on('end', () => {
          resolve(transactions);
        });
    });
  }

  /**
   * Import transactions into database
   */
  async importTransactions(
    accountId: number,
    transactions: GlobalPokerTransaction[]
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: []
    };

    // Sort transactions by date (oldest first)
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const transaction of transactions) {
      try {
        // Check if transaction already exists
        const exists = await this.transactionExists(
          accountId,
          transaction.date,
          transaction.type,
          transaction.amount,
          transaction.balance
        );

        if (exists) {
          result.skipped++;
          continue;
        }

        // Insert transaction
        await this.insertTransaction(accountId, transaction);
        result.imported++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error importing transaction: ${errorMessage}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Check if a transaction already exists
   */
  private transactionExists(
    accountId: number,
    date: Date,
    type: string,
    amount: number,
    balance: number
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) as count
        FROM transactions
        WHERE account_id = ?
          AND datetime(transaction_date) = datetime(?)
          AND type = ?
          AND amount = ?
          AND account_balance = ?
      `;

      this.db.get(sql, [accountId, date.toISOString(), type, amount, balance], (err, row: any) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      });
    });
  }

  /**
   * Insert a transaction into the database
   */
  private insertTransaction(
    accountId: number,
    transaction: GlobalPokerTransaction
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO transactions (
          account_id,
          transaction_date,
          type,
          amount,
          account_balance,
          description,
          is_external
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const isExternal = this.isExternalTransaction(transaction.type);

      this.db.run(
        sql,
        [
          accountId,
          transaction.date.toISOString(),
          transaction.type,
          transaction.amount,
          transaction.balance,
          transaction.description,
          isExternal ? 1 : 0
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get or create account for Global Poker
   */
  async getOrCreateAccount(name: string): Promise<number> {
    return new Promise((resolve, reject) => {
      // First try to find existing account
      this.db.get(
        'SELECT id FROM accounts WHERE name = ? AND platform = ?',
        [name, 'Global Poker'],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve(row.id);
          } else {
            // Create new account
            this.db.run(
              'INSERT INTO accounts (name, platform) VALUES (?, ?)',
              [name, 'Global Poker'],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          }
        }
      );
    });
  }
}