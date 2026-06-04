import "dotenv/config";
import { Client } from "pg";

export function connectionString(): string {
  // POSTGRES_URL_NON_POOLING is preferred for DDL/migrations (direct, unpooled);
  // fall back to the pooled URL or DATABASE_URL.
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) is not set. Copy .env.example to .env and fill it in.",
    );
  }
  return url;
}

export async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
