import express from 'express';
import { 
  getAllSessions, 
  createSession, 
  updateSession, 
  deleteSession, 
  getSessionStats,
  getSessionById,
  addHandNote,
  getHandNotes,
  deleteHandNote,
  getYearProgress,
  getAvailableYears,
  getProgressData,
  getWeeklyProgressData,
  getTotals
} from '../database/db';
import { getDatabase } from '../database/connection';
import { CreateSessionRequest, CreateCompletedSessionRequest, CashOutRequest } from '../models/Session';

import { DEFAULT_CONFIG } from '../config/dropdowns';

const router = express.Router();

// GET /api/sessions - Get all sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await getAllSessions();
    
    // Also get imported external transactions if requested
    if (req.query.includeImports === 'true') {
      const db = getDatabase();
      
      const importedTransactions = await new Promise<any[]>((resolve, reject) => {
        db.all(`
          SELECT 
            t.id,
            t.transaction_date as date,
            t.type,
            t.amount,
            t.account_balance,
            a.name as account_name,
            a.platform
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          WHERE t.is_external = 1
          ORDER BY t.transaction_date DESC
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Convert imported transactions to session-like format
      const importedAsSessions = importedTransactions.map(t => ({
        id: `import_${t.id}`,
        date: t.date,
        endDate: t.date,
        gameType: t.type === 'Purchase - Credit Card' ? 'deposit' : 'withdrawal',
        buyIn: 0, // No buy-in for transfers
        cashOut: Math.abs(t.amount), // Show the amount
        profit: t.type === 'Purchase - Credit Card' ? -Math.abs(t.amount) : Math.abs(t.amount), // Purchases negative, Redemptions positive
        duration: 0,
        location: t.account_name,
        game: t.platform,
        blinds: '',
        notes: t.type,
        isActive: false,
        isImported: true,
        importType: t.type
      }));

      // Combine and sort by date
      const allSessions = [...sessions, ...importedAsSessions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      res.json(allSessions);
    } else {
      res.json(sessions);
    }
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// POST /api/sessions - Create new active session
router.post('/', async (req, res) => {
  try {
    const { gameType, buyIn, location, game, blinds, notes }: CreateSessionRequest = req.body;
    
    if (!gameType || !buyIn) {
      return res.status(400).json({ error: 'gameType and buyIn are required' });
    }
    
    if (buyIn <= 0) {
      return res.status(400).json({ error: 'buyIn must be greater than 0' });
    }
    
    const newSession = await createSession({
      date: new Date().toISOString(),
      gameType,
      buyIn,
      location,
      game,
      blinds,
      notes,
      isActive: true
    });
    
    res.status(201).json(newSession);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions/stats - Get session statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await getSessionStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/sessions/config - Get dropdown configurations
router.get('/config', async (req, res) => {
  try {
    res.json(DEFAULT_CONFIG);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// GET /api/sessions/available-years - Get available years
router.get('/available-years', async (req, res) => {
  try {
    const years = await getAvailableYears();
    // If no years available, return current year
    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }
    res.json(years);
  } catch (error) {
    console.error('Error fetching available years:', error);
    res.status(500).json({ error: 'Failed to fetch available years' });
  }
});

// GET /api/sessions/year-progress/:year - Get year progress data
router.get('/year-progress/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const filter = req.query.filter || 'all'; // 'all', 'live', or 'online'
    
    if (isNaN(year) || year < 1900 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    
    const progressData = await getYearProgress(year, filter as string);
    res.json(progressData);
  } catch (error) {
    console.error('Error fetching year progress:', error);
    res.status(500).json({ error: 'Failed to fetch year progress' });
  }
});

// GET /api/sessions/progress/weekly - Get weekly progress data for time period
router.get('/progress/weekly', async (req, res) => {
  try {
    const period = req.query.period || '1m'; // '1m', '3m', '6m', '12m', 'all'
    const filter = req.query.filter || 'all'; // 'all', 'live', or 'online'
    
    const validPeriods = ['1m', '3m', '6m', '12m', 'all'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({ error: 'Invalid period. Must be 1m, 3m, 6m, 12m, or all' });
    }
    
    const progressData = await getWeeklyProgressData(period as string, filter as string);
    res.json(progressData);
  } catch (error) {
    console.error('Error fetching weekly progress data:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: 'Failed to fetch progress data', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch progress data' });
    }
  }
});

// GET /api/sessions/totals - Get totals (all, live, online)
router.get('/totals', async (req, res) => {
  try {
    const totals = await getTotals();
    res.json(totals);
  } catch (error) {
    console.error('Error fetching totals:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: 'Failed to fetch totals', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch totals' });
    }
  }
});

// POST /api/sessions/completed - Create completed session with custom dates
router.post('/completed', async (req, res) => {
  try {
    const { gameType, buyIn, cashOut, startDate, endDate, location, game, blinds, notes }: CreateCompletedSessionRequest = req.body;
    
    if (!gameType || !buyIn || cashOut === undefined || cashOut === null || !startDate || !endDate) {
      return res.status(400).json({ error: 'gameType, buyIn, cashOut, startDate, and endDate are required' });
    }
    
    if (buyIn <= 0) {
      return res.status(400).json({ error: 'buyIn must be greater than 0' });
    }
    
    if (cashOut < 0) {
      return res.status(400).json({ error: 'cashOut cannot be negative' });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    if (end <= start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }
    
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
    const profit = cashOut - buyIn;
    
    const newSession = await createSession({
      date: start.toISOString(),
      endDate: end.toISOString(),
      gameType,
      buyIn,
      cashOut,
      profit,
      duration,
      location,
      game,
      blinds,
      notes,
      isActive: false
    });
    
    res.status(201).json(newSession);
  } catch (error) {
    console.error('Error creating completed session:', error);
    res.status(500).json({ error: 'Failed to create completed session' });
  }
});

// PUT /api/sessions/:id - Update session
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    const updatedSession = await updateSession(id, updates);
    res.json(updatedSession);
  } catch (error) {
    console.error('Error updating session:', error);
    if (error instanceof Error && error.message === 'Session not found') {
      res.status(404).json({ error: 'Session not found' });
    } else {
      res.status(500).json({ error: 'Failed to update session' });
    }
  }
});

// POST /api/sessions/:id/cashout - Cash out active session
router.post('/:id/cashout', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { cashOut, duration, notes }: CashOutRequest = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    if (cashOut === undefined || cashOut === null || isNaN(cashOut)) {
      return res.status(400).json({ error: 'Valid cashOut amount is required' });
    }
    
    if (cashOut < 0) {
      return res.status(400).json({ error: 'cashOut cannot be negative' });
    }
    
    // Get current session to calculate profit
    const currentSession = await getSessionById(id);
    const profit = cashOut - currentSession.buyIn;
    
    // Set end date to now if not already set
    const endDate = new Date().toISOString();
    
    const updatedSession = await updateSession(id, {
      cashOut,
      profit,
      duration,
      endDate,
      notes: notes || currentSession.notes,
      isActive: false
    });
    
    res.json(updatedSession);
  } catch (error) {
    console.error('Error cashing out session:', error);
    if (error instanceof Error && error.message === 'Session not found') {
      res.status(404).json({ error: 'Session not found' });
    } else {
      res.status(500).json({ error: 'Failed to cash out session' });
    }
  }
});

// DELETE /api/sessions/:id - Delete session
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    await deleteSession(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// POST /api/sessions/:id/hand-notes - Add hand note to session
router.post('/:id/hand-notes', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const { handCards, position, result, noteText } = req.body;
    
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    if (!noteText || noteText.trim().length === 0) {
      return res.status(400).json({ error: 'Note text is required' });
    }
    
    const handNote = await addHandNote(sessionId, {
      handCards,
      position,
      result,
      noteText: noteText.trim()
    });
    
    res.status(201).json(handNote);
  } catch (error) {
    console.error('Error adding hand note:', error);
    res.status(500).json({ error: 'Failed to add hand note' });
  }
});

// GET /api/sessions/:id/hand-notes - Get hand notes for session
router.get('/:id/hand-notes', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    const handNotes = await getHandNotes(sessionId);
    res.json(handNotes);
  } catch (error) {
    console.error('Error fetching hand notes:', error);
    res.status(500).json({ error: 'Failed to fetch hand notes' });
  }
});

// DELETE /api/sessions/hand-notes/:noteId - Delete hand note
router.delete('/hand-notes/:noteId', async (req, res) => {
  try {
    const noteId = parseInt(req.params.noteId);
    
    if (isNaN(noteId)) {
      return res.status(400).json({ error: 'Invalid note ID' });
    }
    
    await deleteHandNote(noteId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting hand note:', error);
    res.status(500).json({ error: 'Failed to delete hand note' });
  }
});

// GET /api/sessions/imported-accounts - Get imported accounts
router.get('/imported-accounts', async (req, res) => {
  try {
    const db = getDatabase();
    
    const accounts = await new Promise<any[]>((resolve, reject) => {
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
        HAVING transaction_count > 0
        ORDER BY a.name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json(accounts);
  } catch (error) {
    console.error('Error fetching imported accounts:', error);
    res.status(500).json({ error: 'Failed to fetch imported accounts' });
  }
});

// GET /api/sessions/imported/:accountId - Get transactions for imported account
router.get('/imported/:accountId', async (req, res) => {
  try {
    const db = getDatabase();
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const transactions = await new Promise<any[]>((resolve, reject) => {
      db.all(`
        SELECT 
          t.*,
          a.name as account_name,
          a.platform
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE t.account_id = ?
        ORDER BY t.transaction_date DESC
      `, [accountId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching account transactions:', error);
    res.status(500).json({ error: 'Failed to fetch account transactions' });
  }
});

export default router;