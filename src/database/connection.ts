// src/database/connection.ts
import { getDb } from './db';

export function getDatabase() {
  const db = getDb();
  if (!db) {
    throw new Error('Database not initialized. Please ensure initDatabase() is called first.');
  }
  return db;
}