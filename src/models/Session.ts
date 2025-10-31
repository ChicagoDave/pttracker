export interface Session {
  id?: number;
  date: string;
  endDate?: string;
  gameType: 'cash' | 'tournament';
  buyIn: number;
  cashOut?: number;
  profit?: number;
  duration?: number;
  location?: string;
  game?: string;
  blinds?: string;
  notes?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalBuyIns: number;
  totalCashOuts: number;
  totalProfit: number;
  winRate: number;
  avgBuyIn: number;
  avgCashOut: number;
  avgProfit: number;
  biggestWin: number;
  biggestLoss: number;
  totalHours: number;
  hourlyRate: number;
}

export interface CreateSessionRequest {
  gameType: 'cash' | 'tournament';
  buyIn: number;
  location?: string;
  game?: string;
  blinds?: string;
  notes?: string;
}

export interface CreateCompletedSessionRequest {
  gameType: 'cash' | 'tournament';
  buyIn: number;
  cashOut: number;
  startDate: string;
  endDate: string;
  location?: string;
  game?: string;
  blinds?: string;
  notes?: string;
}

export interface CashOutRequest {
  cashOut: number;
  duration?: number;
  notes?: string;
}