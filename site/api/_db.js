import { createClient } from "@libsql/client";

/** Returns a Turso client, or null when the database is not configured. */
export function database() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return url && authToken ? createClient({ url, authToken }) : null;
}
