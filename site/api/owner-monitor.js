import { createClient } from "@libsql/client";
import { sameOriginRequest, verifyOwnerSession } from "./_owner-auth.js";
import { ensureMonitoringTables, recordOwnerAudit } from "./_monitoring.js";

function database() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return url && authToken ? createClient({ url, authToken }) : null;
}

function cleanText(value, max = 200) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) : "";
}

function parseDetail(value) {
  try { return JSON.parse(String(value || "{}")); }
  catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const owner = verifyOwnerSession(req);
  if (!owner) return res.status(401).json({ error: "Owner authentication required." });
  const db = database();
  if (!db) return res.status(503).json({ error: "Monitoring database is not configured." });

  try {
    await ensureMonitoringTables(db);

    if (req.method === "POST") {
      if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });
      const action = cleanText(req.body?.action, 30);
      const userId = cleanText(req.body?.userId, 200);
      const reason = cleanText(req.body?.reason, 240);
      if (!/^[A-Za-z0-9:_-]{1,200}$/.test(userId)) return res.status(400).json({ error: "Choose a valid user." });
      if (!['suspend', 'restore'].includes(action)) return res.status(400).json({ error: "Unsupported owner action." });
      if (action === "suspend" && reason.length < 3) return res.status(400).json({ error: "Add a short suspension reason." });
      const status = action === "suspend" ? "suspended" : "active";
      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO owner_user_controls (user_id,status,reason,updated_at,updated_by)
              VALUES (?,?,?,?,?)
              ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated_at=excluded.updated_at,updated_by=excluded.updated_by`,
        args: [userId, status, action === "suspend" ? reason : "", now, owner.email],
      });
      await recordOwnerAudit(db, { actor: owner.email, action: `user_${action}`, targetUserId: userId, detail: { reason } });
      return res.status(200).json({ ok: true, status });
    }

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const query = cleanText(req.query?.q, 80).toLowerCase();
    const [summaryResult, usersResult, activityResult, auditResult] = await Promise.all([
      db.execute(`WITH ids AS (
        SELECT user_id FROM expenses UNION SELECT user_id FROM budgets UNION SELECT user_id FROM finance_state UNION SELECT user_id FROM app_users
      ) SELECT
        (SELECT COUNT(*) FROM ids) AS total_users,
        (SELECT COUNT(*) FROM owner_user_controls WHERE status='suspended') AS suspended_users,
        (SELECT COUNT(DISTINCT user_id) FROM app_activity WHERE created_at >= datetime('now','-1 day')) AS active_24h,
        (SELECT COUNT(*) FROM expenses) AS total_expenses,
        (SELECT COUNT(*) FROM app_activity WHERE created_at >= datetime('now','-1 day')) AS events_24h`),
      db.execute({
        sql: `WITH ids AS (
          SELECT user_id FROM expenses UNION SELECT user_id FROM budgets UNION SELECT user_id FROM finance_state UNION SELECT user_id FROM app_users
        )
        SELECT ids.user_id, COALESCE(u.display_name,'') AS display_name, COALESCE(u.profile_photo_url,'') AS profile_photo_url,
          COALESCE(c.status,'active') AS status, COALESCE(c.reason,'') AS status_reason,
          COALESCE((SELECT COUNT(*) FROM expenses e WHERE e.user_id=ids.user_id),0) AS expense_count,
          COALESCE((SELECT COUNT(*) FROM budgets b WHERE b.user_id=ids.user_id),0) AS budget_count,
          COALESCE((SELECT COUNT(*) FROM app_activity a WHERE a.user_id=ids.user_id),0) AS activity_count,
          COALESCE((SELECT MAX(created_at) FROM app_activity a WHERE a.user_id=ids.user_id), u.last_seen_at, '') AS last_active_at,
          COALESCE((SELECT MAX(created_at) FROM expenses e WHERE e.user_id=ids.user_id), (SELECT updated_at FROM finance_state f WHERE f.user_id=ids.user_id), '') AS last_data_at
        FROM ids
        LEFT JOIN app_users u ON u.user_id=ids.user_id
        LEFT JOIN owner_user_controls c ON c.user_id=ids.user_id
        WHERE (?='' OR LOWER(ids.user_id) LIKE ? OR LOWER(COALESCE(u.display_name,'')) LIKE ?)
        ORDER BY CASE WHEN COALESCE(c.status,'active')='suspended' THEN 0 ELSE 1 END, COALESCE(last_active_at,last_data_at,'') DESC
        LIMIT 200`,
        args: [query, `%${query}%`, `%${query}%`],
      }),
      db.execute("SELECT id,user_id,source,event_type,detail,created_at FROM app_activity ORDER BY created_at DESC LIMIT 100"),
      db.execute("SELECT id,actor,action,target_user_id,detail,created_at FROM owner_audit_log ORDER BY created_at DESC LIMIT 100"),
    ]);

    const summary = summaryResult.rows[0] || {};
    return res.status(200).json({
      owner: { email: owner.email },
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: Number(summary.total_users || 0),
        suspendedUsers: Number(summary.suspended_users || 0),
        active24h: Number(summary.active_24h || 0),
        totalExpenses: Number(summary.total_expenses || 0),
        events24h: Number(summary.events_24h || 0),
      },
      users: usersResult.rows.map((row) => ({
        userId: String(row.user_id), displayName: String(row.display_name || ""), profilePhotoUrl: String(row.profile_photo_url || ""),
        status: String(row.status || "active"), statusReason: String(row.status_reason || ""), expenseCount: Number(row.expense_count || 0),
        budgetCount: Number(row.budget_count || 0), activityCount: Number(row.activity_count || 0), lastActiveAt: String(row.last_active_at || ""), lastDataAt: String(row.last_data_at || ""),
      })),
      activity: activityResult.rows.map((row) => ({ id: String(row.id), userId: String(row.user_id), source: String(row.source), eventType: String(row.event_type), detail: parseDetail(row.detail), createdAt: String(row.created_at) })),
      audit: auditResult.rows.map((row) => ({ id: String(row.id), actor: String(row.actor), action: String(row.action), targetUserId: row.target_user_id ? String(row.target_user_id) : "", detail: parseDetail(row.detail), createdAt: String(row.created_at) })),
    });
  } catch (error) {
    console.error("owner monitor failed", error);
    return res.status(500).json({ error: "Owner monitoring is temporarily unavailable." });
  }
}

