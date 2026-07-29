import { randomUUID } from "node:crypto";

export async function ensureMonitoringTables(db) {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS app_users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL DEFAULT '',
      profile_photo_url TEXT NOT NULL DEFAULT '',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS owner_user_controls (
      user_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      reason TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS app_activity (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_app_activity_created ON app_activity (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_app_activity_user ON app_activity (user_id, created_at DESC)",
    `CREATE TABLE IF NOT EXISTS owner_audit_log (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target_user_id TEXT,
      detail TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_owner_audit_created ON owner_audit_log (created_at DESC)",
  ], "write");
}

function safeJson(value) {
  try { return JSON.stringify(value && typeof value === "object" ? value : {}); }
  catch { return "{}"; }
}

export async function userControl(db, userId) {
  const result = await db.execute({ sql: "SELECT status,reason,updated_at FROM owner_user_controls WHERE user_id = ?", args: [userId] });
  const row = result.rows[0];
  return row ? { status: String(row.status), reason: String(row.reason || ""), updatedAt: String(row.updated_at || "") } : { status: "active", reason: "", updatedAt: "" };
}

export async function recordActivity(db, { userId, source, eventType, detail = {}, displayName = "", profilePhotoUrl = "" }) {
  if (!userId) return;
  const now = new Date().toISOString();
  await db.batch([
    {
      sql: `INSERT INTO app_users (user_id,display_name,profile_photo_url,first_seen_at,last_seen_at)
            VALUES (?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
              display_name=CASE WHEN excluded.display_name != '' THEN excluded.display_name ELSE app_users.display_name END,
              profile_photo_url=CASE WHEN excluded.profile_photo_url != '' THEN excluded.profile_photo_url ELSE app_users.profile_photo_url END,
              last_seen_at=excluded.last_seen_at`,
      args: [userId, String(displayName || "").slice(0, 80), String(profilePhotoUrl || "").slice(0, 500), now, now],
    },
    {
      sql: "INSERT INTO app_activity (id,user_id,source,event_type,detail,created_at) VALUES (?,?,?,?,?,?)",
      args: [randomUUID(), userId, String(source).slice(0, 40), String(eventType).slice(0, 80), safeJson(detail).slice(0, 2000), now],
    },
  ], "write");
}

export async function recordOwnerAudit(db, { actor, action, targetUserId = null, detail = {} }) {
  await db.execute({
    sql: "INSERT INTO owner_audit_log (id,actor,action,target_user_id,detail,created_at) VALUES (?,?,?,?,?,?)",
    args: [randomUUID(), actor, action, targetUserId, safeJson(detail).slice(0, 2000), new Date().toISOString()],
  });
}

