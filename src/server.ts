import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';
import { initDatabase } from './database/db';
import sessionRoutes from './routes/sessions';
import authRoutes from './routes/auth';
import importRoutes from './routes/import';
import { AuthService, requireAuth, requireAuthPage } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', requireAuth, sessionRoutes);
app.use('/api/import', requireAuth, importRoutes);

// Login page (public)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Main app (protected)
app.get('/', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Import page (protected)
app.get('/import', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/import.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    
    await AuthService.initialize();
    console.log('Authentication initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();