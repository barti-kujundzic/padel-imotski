import { Pool } from 'pg';

// Kreiramo pool povezivanja koristeći tvoj DATABASE_URL iz .env datoteke
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Mala pomoćna funkcija za izvršavanje SQL upita
export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
};