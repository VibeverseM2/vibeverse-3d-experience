import { Pool } from 'pg';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  world_id?: string;
  subscribed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  world_id?: string;
}

let pool: Pool;

export function initializeDatabase() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://vibeverse:vibeverse_dev_password@localhost:5432/vibeverse',
    });
  }
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

export class UserModel {
  static async findByEmail(email: string): Promise<User | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<User | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByWorldId(worldId: string): Promise<User | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM users WHERE world_id = $1', [worldId]);
    return result.rows[0] || null;
  }

  static async create(userData: CreateUserInput): Promise<User> {
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, world_id) VALUES ($1, $2, $3) RETURNING *',
      [userData.email, userData.password_hash, userData.world_id]
    );
    return result.rows[0];
  }

  static async updateWorldId(userId: number, worldId: string): Promise<User> {
    const pool = getPool();
    const result = await pool.query(
      'UPDATE users SET world_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [worldId, userId]
    );
    return result.rows[0];
  }

  static async updateSubscription(userId: number, subscribed: boolean): Promise<User> {
    const pool = getPool();
    const result = await pool.query(
      'UPDATE users SET subscribed = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [subscribed, userId]
    );
    return result.rows[0];
  }
}