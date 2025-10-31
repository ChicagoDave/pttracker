import bcryptjs from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

export interface AuthUser {
  username: string;
  isAuthenticated: boolean;
}

interface StoredCredentials {
  username: string;
  passwordHash: string;
}

export class AuthService {
  private static credentialsPath = path.join(process.cwd(), '.auth.json');
  private static credentials: StoredCredentials;

  static async initialize() {
    // Check if credentials file exists
    if (fs.existsSync(this.credentialsPath)) {
      // Load existing credentials
      const data = fs.readFileSync(this.credentialsPath, 'utf8');
      this.credentials = JSON.parse(data);
      console.log('Loaded existing credentials for user:', this.credentials.username);
    } else {
      // Create new credentials from environment variables
      const username = process.env.AUTH_USERNAME || 'admin';
      const password = process.env.AUTH_PASSWORD || 'change_me';
      
      // Hash the password
      const passwordHash = await bcryptjs.hash(password, 10);
      
      this.credentials = {
        username,
        passwordHash
      };
      
      // Save credentials to file
      fs.writeFileSync(this.credentialsPath, JSON.stringify(this.credentials, null, 2));
      console.log('Created new credentials for user:', username);
      console.log('Password has been hashed and stored. You can now remove AUTH_PASSWORD from .env');
    }
  }

  static async validateCredentials(username: string, password: string): Promise<boolean> {
    if (!this.credentials) {
      console.error('Authentication not initialized');
      return false;
    }
    
    if (username !== this.credentials.username) {
      console.log('Username mismatch:', username, 'vs', this.credentials.username);
      return false;
    }
    
    const isValid = await bcryptjs.compare(password, this.credentials.passwordHash);
    console.log('Password validation result:', isValid);
    return isValid;
  }

  static getUsername(): string {
    return this.credentials?.username || 'admin';
  }

  // Utility method to update password
  static async updatePassword(newPassword: string): Promise<void> {
    const passwordHash = await bcryptjs.hash(newPassword, 10);
    this.credentials.passwordHash = passwordHash;
    fs.writeFileSync(this.credentialsPath, JSON.stringify(this.credentials, null, 2));
    console.log('Password updated successfully');
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