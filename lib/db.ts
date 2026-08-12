import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { catalog } from "./catalog";

declare global {
  var smackPool: Pool | undefined;
  var smackSchemaReady: Promise<void> | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  globalThis.smackPool ??= new Pool({
    connectionString,
    max: 8,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });
  return globalThis.smackPool;
}

export async function ensureSchema() {
  if (!globalThis.smackSchemaReady) {
    globalThis.smackSchemaReady = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS staff_users (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'manager',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS staff_sessions (
          token_hash TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS products (
          id BIGINT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
          category TEXT NOT NULL,
          image TEXT NOT NULL,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          featured BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS orders (
          id BIGSERIAL PRIMARY KEY,
          code TEXT UNIQUE,
          customer_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'preparing',
          payment_method TEXT NOT NULL,
          cash_received_cents INTEGER,
          total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
          discount_cents INTEGER NOT NULL DEFAULT 0,
          split_count INTEGER NOT NULL DEFAULT 1,
          channel TEXT NOT NULL DEFAULT 'Balcão',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ready_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ
        );
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_count INTEGER NOT NULL DEFAULT 1;
        CREATE TABLE IF NOT EXISTS order_items (
          id BIGSERIAL PRIMARY KEY,
          order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id BIGINT NOT NULL REFERENCES products(id),
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
        );
        CREATE TABLE IF NOT EXISTS finance_entries (
          id BIGSERIAL PRIMARY KEY,
          entry_type TEXT NOT NULL CHECK (entry_type IN ('income','expense')),
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          payment_method TEXT,
          entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS financial_plans (
          id BIGSERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          target_cents INTEGER NOT NULL CHECK (target_cents > 0),
          current_cents INTEGER NOT NULL DEFAULT 0,
          due_date DATE,
          status TEXT NOT NULL DEFAULT 'active',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
        CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
        CREATE INDEX IF NOT EXISTS finance_entry_date_idx ON finance_entries(entry_date DESC);
      `);

      // Semente inicial: só cria a linha se ela ainda não existir. A partir daí
      // o banco é a fonte de verdade — edições feitas na tela Cardápio não são
      // mais sobrescritas a cada reinício do servidor.
      for (const product of catalog) {
        await db.query(
          `INSERT INTO products (id,name,description,price_cents,category,image,featured)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO NOTHING`,
          [product.id, product.name, product.description, product.priceCents, product.category, product.image, Boolean(product.featured)],
        );
      }
    })().catch((error) => {
      globalThis.smackSchemaReady = undefined;
      throw error;
    });
  }
  return globalThis.smackSchemaReady;
}

export async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []) {
  await ensureSchema();
  return getPool().query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
