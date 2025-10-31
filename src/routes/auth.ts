import express from 'express';
import { AuthService } from '../middleware/auth';

const router = express.Router();

// POST /api/auth/login - Login endpoint
router.post('/login', async (req: any, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const isValid = await AuthService.validateCredentials(username, password);
    
    if (isValid) {
      // Set session
      req.session.user = {
        username: AuthService.getUsername(),
        isAuthenticated: true
      };
      
      res.json({ success: true, username: AuthService.getUsername() });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout - Logout endpoint
router.post('/logout', (req: any, res) => {
  req.session.destroy((err: any) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// GET /api/auth/me - Get current user
router.get('/me', (req: any, res) => {
  if (req.session && req.session.user && req.session.user.isAuthenticated) {
    res.json({ 
      authenticated: true, 
      username: req.session.user.username 
    });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;