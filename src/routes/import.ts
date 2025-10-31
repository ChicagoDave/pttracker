// src/routes/import.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { CsvParserService } from '../services/csvParser';
import { getDatabase } from '../database/connection';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed') as any, false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * POST /api/import/csv
 * Import transactions from CSV file
 */
router.post('/csv', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { accountName } = req.body;
  
  if (!accountName) {
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Account name is required' });
  }

  try {
    console.log('Import request received');
    console.log('Account name:', accountName);
    console.log('File details:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size
    });

    const db = getDatabase();
    const parser = new CsvParserService(db);

    // Get or create account
    console.log('Getting or creating account...');
    const accountId = await parser.getOrCreateAccount(accountName);
    console.log('Account ID:', accountId);

    // Parse CSV file
    console.log('Parsing CSV file...');
    const transactions = await parser.parseGlobalPokerCsv(req.file.path);
    console.log('Parsed transactions:', transactions.length);

    if (transactions.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No valid transactions found in CSV' });
    }

    // Import transactions
    console.log('Importing transactions...');
    const result = await parser.importTransactions(accountId, transactions);
    console.log('Import result:', result);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: result.success,
      message: `Imported ${result.imported} transactions, skipped ${result.skipped} duplicates`,
      details: result
    });
  } catch (error) {
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      error: 'Failed to import CSV',
      message: errorMessage 
    });
  }
});

/**
 * GET /api/import/sample
 * Get sample CSV format
 */
router.get('/sample', (req: Request, res: Response) => {
  const sampleData = `"Date","Type","Amount","Balance"
"06/13/25, 4:58 PM CDT","Tournament Registration",-33,12.25
"06/13/25, 4:58 PM CDT","Purchase - Credit Card",20,45.25
"06/13/25, 4:57 PM CDT","Daily Bonus",0.25,25.25`;

  res.json({
    format: 'Global Poker CSV',
    columns: ['Date', 'Type', 'Amount', 'Balance'],
    sample: sampleData,
    notes: [
      'Date format: MM/DD/YY, H:MM AM/PM TZ',
      'Amount: Positive for deposits/winnings, negative for withdrawals/buy-ins',
      'Balance: Running account balance after transaction'
    ]
  });
});

/**
 * GET /api/import/transaction-types
 * Get list of recognized transaction types
 */
router.get('/transaction-types', (req: Request, res: Response) => {
  res.json({
    external: [
      'Purchase - Credit Card',
      'Redemption'
    ],
    internal: [
      'Tournament Registration',
      'Tournament Payout',
      'Tournament Re-buy',
      'Tournament Add-on',
      'Tournament Bounty',
      'Tournament Unregistration',
      'Daily Bonus',
      'Daily Bonus Boost',
      'Prize Draw',
      'Vault Bonus Claim'
    ]
  });
});

/**
 * GET /api/import/accounts
 * Get list of imported accounts with transaction counts
 */
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    db.all(`
      SELECT 
        a.id,
        a.name,
        a.platform,
        COUNT(t.id) as transaction_count,
        MIN(t.transaction_date) as first_transaction,
        MAX(t.transaction_date) as last_transaction,
        SUM(CASE WHEN t.is_external = 1 THEN t.amount ELSE 0 END) as real_money_balance,
        MAX(t.account_balance) as current_balance
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `, (err, rows) => {
      if (err) {
        console.error('Error fetching accounts:', err);
        res.status(500).json({ error: 'Failed to fetch accounts' });
      } else {
        res.json({
          accounts: rows || [],
          total: rows ? rows.length : 0
        });
      }
    });
  } catch (error) {
    console.error('Error in /accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/import/accounts/:id/transactions
 * Get transactions for a specific account
 */
router.get('/accounts/:id/transactions', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const accountId = parseInt(req.params.id);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    db.all(`
      SELECT 
        id,
        transaction_date,
        type,
        amount,
        account_balance,
        real_money_balance,
        is_external,
        imported_at
      FROM transactions
      WHERE account_id = ?
      ORDER BY transaction_date DESC
      LIMIT 100
    `, [accountId], (err, rows) => {
      if (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
      } else {
        res.json({
          transactions: rows || [],
          total: rows ? rows.length : 0
        });
      }
    });
  } catch (error) {
    console.error('Error in /accounts/:id/transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;