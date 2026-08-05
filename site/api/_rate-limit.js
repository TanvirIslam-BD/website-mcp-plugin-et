/**
 * Serverless-safe rate limiting.
 *
 * An in-process Map only limits a single lambda instance, which means a real
 * caller simply lands on a fresh instance and starts over. Counters live in the
 * database instead, incremented by one atomic upsert per check.
 */
/**
 * @param {object} options
 * @param {number} options.limit    requests allowed per window
 * @param {number} options.windowMs window length
 * @param {boolean} [options.failClosed]
 *   What to do when the counter itself cannot be read. Default false — a limiter
 *   outage must not take a user-facing endpoint down, and those endpoints need
 *   the same database anyway. Set true for brute-force protection, where losing
 *   the limiter means losing the only thing standing in the way.
 */
export async function consumeRateLimit(db, key, { limit, windowMs, failClosed = false }) {
  const now = Date.now();
  const cutoff = now - windowMs;
  try {
    const result = await db.execute({
      sql: `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
            ON CONFLICT(key) DO UPDATE SET
              count = CASE WHEN rate_limits.window_start <= ? THEN 1 ELSE rate_limits.count + 1 END,
              window_start = CASE WHEN rate_limits.window_start <= ? THEN ? ELSE rate_limits.window_start END
            RETURNING count, window_start`,
      args: [String(key).slice(0, 200), now, cutoff, cutoff, now],
    });
    const row = result.rows[0];
    const count = Number(row?.count || 1);
    const windowStart = Number(row?.window_start || now);
    return {
      allowed: count <= limit,
      count,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
    };
  } catch (error) {
    console.error(`rate limit check failed (failClosed=${failClosed})`, error);
    return {
      allowed: !failClosed,
      count: 0,
      retryAfterSeconds: failClosed ? Math.ceil(windowMs / 1000) : 1,
      unavailable: true,
    };
  }
}

/**
 * Resolves the caller's address for rate-limit keying.
 *
 * `x-forwarded-for` is attacker-controllable: a client can send its own header
 * and, if the platform appends rather than replaces, the first entry is forged —
 * which would let someone rotate the value to get unlimited attempts. The
 * Vercel-set headers cannot be spoofed, so they are preferred, and the
 * last entry of `x-forwarded-for` (appended by the closest proxy) is used before
 * ever trusting the first.
 */
export function clientAddress(req) {
  const vercelForwarded = String(req.headers["x-vercel-forwarded-for"] || "").split(",").pop()?.trim();
  if (vercelForwarded) return vercelForwarded;

  const realIp = String(req.headers["x-real-ip"] || "").trim();
  if (realIp) return realIp;

  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").pop()?.trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}
