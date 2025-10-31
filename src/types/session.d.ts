import 'express-session';
import { Request } from 'express';

declare module 'express-session' {
  interface SessionData {
    user?: {
      username: string;
      isAuthenticated: boolean;
    };
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    session: import('express-session').Session & Partial<import('express-session').SessionData>;
  }
}