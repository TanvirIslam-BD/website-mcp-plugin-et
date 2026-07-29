const MCPIZE_PROFILE_ENDPOINT = "https://be.mcpize.com/rest/v1/profiles";

// This public, read-only anon key is published by MCPize's own web client.
// It is used only to resolve the authenticated user's public profile fields.
const MCPIZE_PUBLIC_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3Zhb2NxZ3VoaHZwaGhicXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMjIzNTksImV4cCI6MjA3NTY5ODM1OX0.x_CISxdW0i3twjkyqFewE8TGucEYRInCFbM_JucpuX8";

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

export async function readMcpizeProfile(userId) {
  if (!userId) return { displayName: "", profilePhotoUrl: "" };
  try {
    const url = new URL(MCPIZE_PROFILE_ENDPOINT);
    url.searchParams.set("id", `eq.${userId}`);
    url.searchParams.set("select", "full_name,username,avatar_url");
    const response = await fetch(url, {
      headers: {
        apikey: MCPIZE_PUBLIC_ANON_KEY,
        Authorization: `Bearer ${MCPIZE_PUBLIC_ANON_KEY}`,
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
