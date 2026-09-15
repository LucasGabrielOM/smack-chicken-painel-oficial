import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { catalog } from "./catalog";

declare global {
  var smackPool: Pool | undefined;
  var smackSchemaReady: Promise<void> | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  const isNeonOrRemote =
    connectionString.includes("neon.tech") ||
    connectionString.includes("sslmode=require") ||
    process.env.PGSSLMODE === "require" ||
    process.env.NODE_ENV === "production";

  globalThis.smackPool ??= new Pool({
    connectionString,
    max: 8,
    ssl: isNeonOrRemote ? { rejectUnauthorized: false } : undefined,
  });
  return globalThis.smackPool;
}

export async function ensureSchema() {
  if (!process.env.DATABASE_URL) return;
  if (!globalThis.smackSchemaReady) {
    globalThis.smackSchemaReady = (async () => {
      const db = getPool();
      if (!db) return;
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

        -- Remove foreign key de order_items para não travar atualizações de catálogo
        ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

        -- Limpa doces excluídos do cardápio e IDs corrompidos do banco antigo
        DELETE FROM products WHERE category = 'Doces' OR id IN (47, 48, 49, 50, 51);
        DELETE FROM products WHERE id IN (57, 58) AND (name ILIKE 'Smack %' OR name ILIKE '%Marmita%');
        DELETE FROM products WHERE id = 56 AND (name ILIKE '%Original%' OR price_cents != 4990);
        DELETE FROM products WHERE id = 52 AND name ILIKE '%Fresh%';
        DELETE FROM products WHERE id = 55 AND name ILIKE '%Smile%';
        DELETE FROM products WHERE id IN (53, 54) AND name ILIKE '%Cebola%';
      `);

      // Sincroniza produtos canônicos do catálogo garantindo integridade de preços e IDs
      for (const product of catalog) {
        await db.query(
          `INSERT INTO products (id, name, description, price_cents, category, image, active, featured)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             description = EXCLUDED.description,
             price_cents = EXCLUDED.price_cents,
             category = EXCLUDED.category,
             image = EXCLUDED.image,
             active = TRUE,
             featured = EXCLUDED.featured`,
          [product.id, product.name, product.description, product.priceCents, product.category, product.image, Boolean(product.featured)],
        );
      }

      // Garante explicitamente os valores canônicos dos lanches e marmita
      await db.query(`
        UPDATE products SET price_cents = 2990, name = 'Smack Original', category = 'Lanches', active = TRUE WHERE id = 53;
        UPDATE products SET price_cents = 3290, name = 'Smack Kids + Batata Smile', category = 'Lanches', active = TRUE WHERE id = 54;
        UPDATE products SET price_cents = 3990, name = 'Smack Fresh', category = 'Lanches', active = TRUE WHERE id = 55;
        UPDATE products SET price_cents = 4990, name = 'Smack Power', category = 'Lanches', active = TRUE WHERE id = 56;
        UPDATE products SET price_cents = 2990, name = 'MARMITA SMACK 600g', category = 'Marmitas', active = TRUE WHERE id = 52;
      `);
    })().catch((error) => {
      globalThis.smackSchemaReady = undefined;
      throw error;
    });
  }
  return globalThis.smackSchemaReady;
}

export async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
  const pool = getPool();
  if (!pool) return { rows: [] as T[], rowCount: 0 };
  try {
    await ensureSchema();
    return await pool.query<T>(text, values);
  } catch (err) {
    console.warn("Postgres query warning:", err);
    return { rows: [] as T[], rowCount: 0 };
  }
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  if (!pool) {
    // Fallback client for environments without postgres
    const mockClient = {
      query: async () => ({ rows: [], rowCount: 0 }),
    } as unknown as PoolClient;
    return await work(mockClient);
  }
  await ensureSchema();
  const client = await pool.connect();
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

