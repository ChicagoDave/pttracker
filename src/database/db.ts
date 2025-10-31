import sqlite3 from 'sqlite3';
import { Session, SessionStats } from '../models/Session';

const DB_PATH = process.env.DB_PATH || './poker.db';

let db: sqlite3.Database;

export function getDb(): sqlite3.Database {
  return db;
}

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Create sessions table with initial schema
      const createTable = `
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          game_type TEXT NOT NULL CHECK(game_type IN ('cash', 'tournament')),
          buy_in REAL NOT NULL,
          cash_out REAL,
          profit REAL,
          duration INTEGER,
          location TEXT,
          notes TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // Create accounts table for CSV imports
      const createAccountsTable = `
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          platform TEXT DEFAULT 'Manual',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // Create transactions table for CSV imports
      const createTransactionsTable = `
        CREATE TABLE IF NOT EXISTS transactions (
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
      `;
      
      db.run(createTable, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create accounts table
        db.run(createAccountsTable, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating accounts table:', err);
          }
        });
        
        // Create transactions table
        db.run(createTransactionsTable, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating transactions table:', err);
          }
        });
        
        // Check if end_date column exists and add it if not
        db.all("PRAGMA table_info(sessions)", [], (err, columns) => {
          if (err) {
            reject(err);
            return;
          }
          
          const columnNames = columns.map((col: any) => col.name);
          const hasEndDate = columnNames.includes('end_date');
          const hasGame = columnNames.includes('game');
          const hasBlinds = columnNames.includes('blinds');
          
          const alterQueries = [];
          
          if (!hasEndDate) {
            alterQueries.push("ALTER TABLE sessions ADD COLUMN end_date TEXT");
          }
          if (!hasGame) {
            alterQueries.push("ALTER TABLE sessions ADD COLUMN game TEXT");
          }
          if (!hasBlinds) {
            alterQueries.push("ALTER TABLE sessions ADD COLUMN blinds TEXT");
          }
          
          // Create hand_notes table
          const createHandNotesTable = `
            CREATE TABLE IF NOT EXISTS hand_notes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id INTEGER NOT NULL,
              hand_cards TEXT,
              position TEXT,
              result TEXT,
              note_text TEXT NOT NULL,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
            )
          `;
          
          alterQueries.push(createHandNotesTable);
          
          if (alterQueries.length === 0) {
            resolve();
            return;
          }
          
          console.log(`Adding ${alterQueries.length} missing columns to sessions table...`);
          
          let completed = 0;
          const total = alterQueries.length;
          
          alterQueries.forEach((query, index) => {
            db.run(query, (err) => {
              if (err) {
                console.warn(`Could not execute: ${query}`, err);
              } else {
                console.log(`Successfully executed: ${query}`);
              }
              
              completed++;
              if (completed === total) {
                resolve();
              }
            });
          });
        });
      });
    });
  });
}

export function getAllSessions(): Promise<Session[]> {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        date,
        end_date as endDate,
        game_type as gameType,
        buy_in as buyIn,
        cash_out as cashOut,
        profit,
        duration,
        location,
        game,
        blinds,
        notes,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM sessions 
      ORDER BY date DESC
    `;
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as Session[]);
      }
    });
  });
}

export function createSession(session: Omit<Session, 'id'>): Promise<Session> {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO sessions (date, end_date, game_type, buy_in, cash_out, profit, duration, location, game, blinds, notes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      session.date,
      session.endDate || null,
      session.gameType,
      session.buyIn,
      session.cashOut || null,
      session.profit || null,
      session.duration || null,
      session.location || null,
      session.game || null,
      session.blinds || null,
      session.notes || null,
      session.isActive ? 1 : 0
    ];
    
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        getSessionById(this.lastID).then(resolve).catch(reject);
      }
    });
  });
}

export function updateSession(id: number, updates: Partial<Session>): Promise<Session> {
  return new Promise((resolve, reject) => {
    const fields = [];
    const params = [];
    
    if (updates.cashOut !== undefined) {
      fields.push('cash_out = ?');
      params.push(updates.cashOut);
    }
    if (updates.profit !== undefined) {
      fields.push('profit = ?');
      params.push(updates.profit);
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      params.push(updates.duration);
    }
    if (updates.endDate !== undefined) {
      fields.push('end_date = ?');
      params.push(updates.endDate);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      params.push(updates.notes);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    const sql = `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`;
    
    db.run(sql, params, (err) => {
      if (err) {
        reject(err);
      } else {
        getSessionById(id).then(resolve).catch(reject);
      }
    });
  });
}

export function deleteSession(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM sessions WHERE id = ?';
    
    db.run(sql, [id], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function getSessionById(id: number): Promise<Session> {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        date,
        end_date as endDate,
        game_type as gameType,
        buy_in as buyIn,
        cash_out as cashOut,
        profit,
        duration,
        location,
        game,
        blinds,
        notes,
        is_active as isActive,
        created_at as createdAt,
        updated_at as updatedAt
      FROM sessions 
      WHERE id = ?
    `;
    
    db.get(sql, [id], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        reject(new Error('Session not found'));
      } else {
        resolve(row as Session);
      }
    });
  });
}

export function getSessionStats(): Promise<SessionStats> {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        COUNT(*) as totalSessions,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeSessions,
        SUM(buy_in) as totalBuyIns,
        SUM(CASE WHEN cash_out IS NOT NULL THEN cash_out ELSE 0 END) as totalCashOuts,
        SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as totalProfit,
        AVG(buy_in) as avgBuyIn,
        AVG(CASE WHEN cash_out IS NOT NULL THEN cash_out ELSE NULL END) as avgCashOut,
        AVG(CASE WHEN profit IS NOT NULL THEN profit ELSE NULL END) as avgProfit,
        MAX(CASE WHEN profit IS NOT NULL THEN profit ELSE NULL END) as biggestWin,
        MIN(CASE WHEN profit IS NOT NULL THEN profit ELSE NULL END) as biggestLoss,
        SUM(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as totalMinutes,
        COUNT(CASE WHEN profit > 0 THEN 1 ELSE NULL END) * 100.0 / COUNT(CASE WHEN profit IS NOT NULL THEN 1 ELSE NULL END) as winRate
      FROM sessions
    `;
    
    db.get(sql, [], (err, row: any) => {
      if (err) {
        reject(err);
      } else {
        const totalHours = (row.totalMinutes || 0) / 60;
        const hourlyRate = totalHours > 0 ? (row.totalProfit || 0) / totalHours : 0;
        
        resolve({
          totalSessions: row.totalSessions || 0,
          activeSessions: row.activeSessions || 0,
          totalBuyIns: row.totalBuyIns || 0,
          totalCashOuts: row.totalCashOuts || 0,
          totalProfit: row.totalProfit || 0,
          winRate: row.winRate || 0,
          avgBuyIn: row.avgBuyIn || 0,
          avgCashOut: row.avgCashOut || 0,
          avgProfit: row.avgProfit || 0,
          biggestWin: row.biggestWin || 0,
          biggestLoss: row.biggestLoss || 0,
          totalHours: totalHours,
          hourlyRate: hourlyRate
        });
      }
    });
  });
}

export function addHandNote(sessionId: number, handNote: {
  handCards?: string;
  position?: string;
  result?: string;
  noteText: string;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO hand_notes (session_id, hand_cards, position, result, note_text)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const params = [
      sessionId,
      handNote.handCards || null,
      handNote.position || null,
      handNote.result || null,
      handNote.noteText
    ];
    
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          id: this.lastID,
          sessionId,
          ...handNote,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
}

export function getHandNotes(sessionId: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        id,
        session_id as sessionId,
        hand_cards as handCards,
        position,
        result,
        note_text as noteText,
        timestamp
      FROM hand_notes 
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `;
    
    db.all(sql, [sessionId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

export function deleteHandNote(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM hand_notes WHERE id = ?';
    
    db.run(sql, [id], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function getYearProgress(year: number, filter: string = 'all'): Promise<any[]> {
  return new Promise((resolve, reject) => {
    let sql: string;
    
    if (filter === 'online') {
      // Only online transactions
      sql = `
        SELECT 
          strftime('%Y-%m-%d', t.transaction_date) as date,
          SUM(CASE 
            WHEN t.type = 'Purchase - Credit Card' THEN -ABS(t.amount)
            WHEN t.type = 'Redemption' THEN ABS(t.amount)
            ELSE 0 
          END) as dailyProfit
        FROM transactions t
        WHERE strftime('%Y', t.transaction_date) = ? 
          AND t.is_external = 1
        GROUP BY strftime('%Y-%m-%d', t.transaction_date)
        ORDER BY date ASC
      `;
    } else if (filter === 'live') {
      // Only live poker sessions
      sql = `
        SELECT 
          strftime('%Y-%m-%d', date) as date,
          SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as dailyProfit
        FROM sessions 
        WHERE strftime('%Y', date) = ? 
          AND is_active = 0
        GROUP BY strftime('%Y-%m-%d', date)
        ORDER BY date ASC
      `;
    } else {
      // All (combine both)
      sql = `
        WITH combined_data AS (
          -- Live sessions
          SELECT 
            strftime('%Y-%m-%d', date) as date,
            SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as dailyProfit
          FROM sessions 
          WHERE strftime('%Y', date) = ? 
            AND is_active = 0
          GROUP BY strftime('%Y-%m-%d', date)
          
          UNION ALL
          
          -- Online transactions
          SELECT 
            strftime('%Y-%m-%d', t.transaction_date) as date,
            SUM(CASE 
              WHEN t.type = 'Purchase - Credit Card' THEN -ABS(t.amount)
              WHEN t.type = 'Redemption' THEN ABS(t.amount)
              ELSE 0 
            END) as dailyProfit
          FROM transactions t
          WHERE strftime('%Y', t.transaction_date) = ? 
            AND t.is_external = 1
          GROUP BY strftime('%Y-%m-%d', t.transaction_date)
        )
        SELECT 
          date,
          SUM(dailyProfit) as dailyProfit
        FROM combined_data
        GROUP BY date
        ORDER BY date ASC
      `;
    }
    
    const params = filter === 'all' ? [year.toString(), year.toString()] : [year.toString()];
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // Calculate cumulative profit
        let cumulativeProfit = 0;
        const progressData = (rows || []).map((row: any) => {
          cumulativeProfit += row.dailyProfit;
          return {
            date: row.date,
            dailyProfit: row.dailyProfit,
            cumulativeProfit: cumulativeProfit
          };
        });
        resolve(progressData);
      }
    });
  });
}

export function getAvailableYears(): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT DISTINCT strftime('%Y', date) as year
      FROM sessions
      WHERE date IS NOT NULL
      ORDER BY year DESC
    `;
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const years = (rows || []).map((row: any) => parseInt(row.year)).filter(year => !isNaN(year));
        resolve(years);
      }
    });
  });
}

export function getProgressData(period: string, filter: string = 'all'): Promise<any[]> {
  return new Promise((resolve, reject) => {
    let sql: string;
    
    if (period === 'quarterly') {
      // Group by quarter
      if (filter === 'online') {
        // Only online transactions
        sql = `
          SELECT 
            strftime('%Y', t.transaction_date) || '-Q' || ((CAST(strftime('%m', t.transaction_date) AS INTEGER) - 1) / 3 + 1) as period,
            SUM(CASE 
              WHEN t.type = 'Purchase - Credit Card' THEN -ABS(t.amount)
              WHEN t.type = 'Redemption' THEN ABS(t.amount)
              ELSE 0 
            END) as periodProfit
          FROM transactions t
          WHERE t.is_external = 1
          GROUP BY period
          ORDER BY period ASC
        `;
      } else if (filter === 'live') {
        // Only live poker sessions
        sql = `
          SELECT 
            strftime('%Y', date) || '-Q' || ((CAST(strftime('%m', date) AS INTEGER) - 1) / 3 + 1) as period,
            SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as periodProfit
          FROM sessions 
          WHERE is_active = 0
          GROUP BY period
          ORDER BY period ASC
        `;
      } else {
        // All (combine both)
        sql = `
          WITH combined_data AS (
            -- Live sessions
            SELECT 
              strftime('%Y', date) || '-Q' || ((CAST(strftime('%m', date) AS INTEGER) - 1) / 3 + 1) as period,
              SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as periodProfit
            FROM sessions 
            WHERE is_active = 0
            GROUP BY period
            
            UNION ALL
            
            -- Online transactions
            SELECT 
              strftime('%Y', t.transaction_date) || '-Q' || ((CAST(strftime('%m', t.transaction_date) AS INTEGER) - 1) / 3 + 1) as period,
              SUM(CASE 
                WHEN t.type = 'Purchase - Credit Card' THEN -ABS(t.amount)
                WHEN t.type = 'Redemption' THEN ABS(t.amount)
                ELSE 0 
              END) as periodProfit
            FROM transactions t
            WHERE t.is_external = 1
            GROUP BY period
          )
          SELECT 
            period,
            SUM(periodProfit) as periodProfit
          FROM combined_data
          GROUP BY period
          ORDER BY period ASC
        `;
      }
    } else {
      // Group by year
      if (filter === 'online') {
        // Only online transactions
        sql = `
          SELECT 
            strftime('%Y', t.transaction_date) as period,
            SUM(CASE 
              WHEN t.type = 'Purchase - Credit Card' THEN -ABS(t.amount)
              WHEN t.type = 'Redemption' THEN ABS(t.amount)
              ELSE 0 
            END) as periodProfit
          FROM transactions t
          WHERE t.is_external = 1
          GROUP BY period
          ORDER BY period ASC
        `;
      } else if (filter === 'live') {
        // Only live poker sessions
        sql = `
          SELECT 
            strftime('%Y', date) as period,
            SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as periodProfit
          FROM sessions 
          WHERE is_active = 0
          GROUP BY period
          ORDER BY period ASC
        `;
      } else {
        // All (combine both)
        sql = `
          WITH combined_data AS (
            -- Live sessions
            SELECT 
              strftime('%Y', date) as period,
              SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as periodProfit
            FROM sessions 
            WHERE is_active = 0
            GROUP BY period
            
            UNION ALL
            
            -- Online transactions
            SELECT 
              strftime('%Y', t.transaction_date) as period,
              SUM(CASE 
                WHEN t.type = 'Purchase - Credit Card' THEN -ABS(t.amount)
                WHEN t.type = 'Redemption' THEN ABS(t.amount)
                ELSE 0 
              END) as periodProfit
            FROM transactions t
            WHERE t.is_external = 1
            GROUP BY period
          )
          SELECT 
            period,
            SUM(periodProfit) as periodProfit
          FROM combined_data
          GROUP BY period
          ORDER BY period ASC
        `;
      }
    }
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('SQL Error in getProgressData:', err);
        console.error('SQL Query:', sql);
        reject(err);
      } else {
        // Calculate cumulative profit
        let cumulativeProfit = 0;
        const progressData = (rows || []).map((row: any) => {
          cumulativeProfit += row.periodProfit || 0;
          return {
            period: row.period,
            periodProfit: row.periodProfit || 0,
            cumulativeProfit: cumulativeProfit
          };
        });
        resolve(progressData);
      }
    });
  });
}

export function getTotals(): Promise<{all: number, live: number, online: number}> {
  return new Promise((resolve, reject) => {
    const queries = [
      // Live sessions total
      `SELECT COALESCE(SUM(profit), 0) as total FROM sessions WHERE is_active = 0`,
      // Online transactions total
      `SELECT COALESCE(SUM(
        CASE 
          WHEN type = 'Purchase - Credit Card' THEN -ABS(amount)
          WHEN type = 'Redemption' THEN ABS(amount)
          ELSE 0 
        END
      ), 0) as total FROM transactions WHERE is_external = 1`
    ];
    
    Promise.all([
      new Promise<number>((resolve, reject) => {
        db.get(queries[0], [], (err, row: any) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      }),
      new Promise<number>((resolve, reject) => {
        db.get(queries[1], [], (err, row: any) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      })
    ]).then(([liveTotal, onlineTotal]) => {
      resolve({
        all: liveTotal + onlineTotal,
        live: liveTotal,
        online: onlineTotal
      });
    }).catch(reject);
  });
}

export function getWeeklyProgressData(period: string, filter: string = 'all'): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // Calculate date range based on period
    const endDate = new Date();
    let startDate = new Date();
    
    switch(period) {
      case '1m':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '12m':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2000-01-01'); // Far back enough to get all data
        break;
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    let sql: string;
    
    if (filter === 'online') {
      // Only online transactions
      sql = `
        SELECT 
          strftime('%Y-%W', t.transaction_date) as yearWeek,
          MIN(date(t.transaction_date, 'weekday 0', '-6 days')) as week,
          SUM(CASE 
            WHEN t.type = 'Purchase - Credit Card' THEN -ABS(t.amount)
            WHEN t.type = 'Redemption' THEN ABS(t.amount)
            ELSE 0 
          END) as weeklyProfit
        FROM transactions t
        WHERE t.is_external = 1
          AND date(t.transaction_date) >= date(?)
          AND date(t.transaction_date) <= date(?)
        GROUP BY yearWeek
        ORDER BY yearWeek ASC
      `;
    } else if (filter === 'live') {
      // Only live poker sessions
      sql = `
        SELECT 
          strftime('%Y-%W', date) as yearWeek,
          MIN(date(date, 'weekday 0', '-6 days')) as week,
          SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as weeklyProfit
        FROM sessions 
        WHERE is_active = 0
          AND date(date) >= date(?)
          AND date(date) <= date(?)
        GROUP BY yearWeek
        ORDER BY yearWeek ASC
      `;
    } else {
      // All (combine both)
      sql = `
        WITH combined_data AS (
          -- Live sessions
          SELECT 
            strftime('%Y-%W', date) as yearWeek,
            MIN(date(date, 'weekday 0', '-6 days')) as week,
            SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) as weeklyProfit
          FROM sessions 
          WHERE is_active = 0
            AND date(date) >= date(?)
            AND date(date) <= date(?)
          GROUP BY yearWeek
          
          UNION ALL
          
          -- Online transactions
          SELECT 
            strftime('%Y-%W', t.transaction_date) as yearWeek,
            MIN(date(t.transaction_date, 'weekday 0', '-6 days')) as week,
            SUM(CASE 
              WHEN t.type = 'Purchase - Credit Card' THEN -ABS(t.amount)
              WHEN t.type = 'Redemption' THEN ABS(t.amount)
              ELSE 0 
            END) as weeklyProfit
          FROM transactions t
          WHERE t.is_external = 1
            AND date(t.transaction_date) >= date(?)
            AND date(t.transaction_date) <= date(?)
          GROUP BY yearWeek
        )
        SELECT 
          yearWeek,
          week,
          SUM(weeklyProfit) as weeklyProfit
        FROM combined_data
        GROUP BY yearWeek
        ORDER BY yearWeek ASC
      `;
    }
    
    const params = filter === 'all' ? 
      [startDateStr, endDateStr, startDateStr, endDateStr] : 
      [startDateStr, endDateStr];
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('SQL Error in getWeeklyProgressData:', err);
        console.error('SQL Query:', sql);
        reject(err);
      } else {
        // Calculate cumulative profit
        let cumulativeProfit = 0;
        const progressData = (rows || []).map((row: any) => {
          cumulativeProfit += row.weeklyProfit || 0;
          return {
            yearWeek: row.yearWeek,
            week: row.week,
            weeklyProfit: row.weeklyProfit || 0,
            cumulativeProfit: cumulativeProfit
          };
        });
        resolve(progressData);
      }
    });
  });
}
