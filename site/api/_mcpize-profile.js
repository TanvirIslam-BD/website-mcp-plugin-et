const MCPIZE_PROFILE_ENDPOINT = "https://be.mcpize.com/rest/v1/profiles";

// Read-only anon key published by MCPize's own web client, used solely to
// resolve the authenticated user's public profile fields. It belongs to a third
// party, so it is configured rather than committed; profile enrichment is simply
// skipped when unset.
function mcpizeAnonKey() {
  return String(process.env.MCPIZE_ANON_KEY || "");
}

export function cleanDisplayName(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80);
}

export function cleanProfilePhoto(value) {
  if (typeof value !== "string" || value.length > 500) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function profileIdFromSubject(value) {
  const subject = typeof value === "string" ? value.trim() : "";
  const uuid = subject.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  return uuid || "";
}

export async function readMcpizeProfile(userId) {
  const anonKey = mcpizeAnonKey();
  const profileId = profileIdFromSubject(userId);
  if (!profileId || !anonKey) return { displayName: "", profilePhotoUrl: "" };
  try {
    const url = new URL(MCPIZE_PROFILE_ENDPOINT);
    // MCP OAuth subjects may be namespaced, while profiles.id is a UUID.
    url.searchParams.set("id", `eq.${profileId}`);
    url.searchParams.set("select", "full_name,username,avatar_url");
    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) return { displayName: "", profilePhotoUrl: "" };
    const rows = await response.json().catch(() => []);
    const profile = Array.isArray(rows) ? rows[0] : null;
    return {
      displayName: cleanDisplayName(profile?.full_name || profile?.username),
      profilePhotoUrl: cleanProfilePhoto(profile?.avatar_url),
    };
  } catch {
    return { displayName: "", profilePhotoUrl: "" };
  }
}
