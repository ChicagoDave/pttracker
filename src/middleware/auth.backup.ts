import bcryptjs from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  username: string;
  isAuthenticated: boolean;
}

export class AuthService {
  private static username = process.env.AUTH_USERNAME || 'admin';
  private static passwordHash: string;

  static async initialize() {
    const password = process.env.AUTH_PASSWORD || 'change_me';
    this.passwordHash = await bcryptjs.hash(password, 10);
    console.log('Authentication initialized for user:', this.username);
  }

  static async validateCredentials(username: string, password: string): Promise<boolean> {
    if (username !== this.username) {
      return false;
    }
    
    return await bcryptjs.compare(password, this.passwordHash);
  }

  static getUsername(): string {
    return this.username;
  }
}

export function requireAuth(req: any, res: Response, next: NextFunction) {
  if (req.session && req.session.user && req.session.user.isAuthenticated) {
    return next();
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

export function requireAuthPage(req: any, res: Response, next: NextFunction) {
  if (req.session && req.session.user && req.session.user.isAuthenticated) {
    return next();
  } else {
    return res.redirect('/login');
  }
}