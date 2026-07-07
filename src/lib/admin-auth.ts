export const ADMIN_COOKIE = "dcf_admin_session";

// "manager" = full admin (orders + menu management); "staff" = orders only.
// Which role you get is decided by which password you log in with:
// ADMIN_PASSWORD → manager, STAFF_PASSWORD (optional) → staff.
export type AdminRole = "manager" | "staff";

function getSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("ADMIN_PASSWORD is not set");
  return secret;
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Session token proving the caller supplied a valid password, without embedding
 * the password itself. Format: "<role>.<signature>" — the role part is readable
 * (the proxy needs it to authorize per-route) but covered by the HMAC, so a
 * client editing "staff" to "manager" in their cookie invalidates the signature.
 */
export async function createAdminSessionToken(role: AdminRole): Promise<string> {
  const sig = await sign(`admin-session:${role}`);
  return `${role}.${sig}`;
}

/** Returns the session's role, or null if the token is missing/invalid/tampered. */
export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<AdminRole | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const role = token.slice(0, dot);
  if (role !== "manager" && role !== "staff") return null;
  const expected = await createAdminSessionToken(role);
  return token === expected ? role : null;
}

/**
 * Maps a submitted password to a role, or null if it matches neither.
 * ADMIN_PASSWORD is checked first, so if STAFF_PASSWORD is misconfigured to the
 * same value, the login still grants manager (never silently downgrades).
 * With STAFF_PASSWORD unset, staff login simply doesn't exist — same behavior
 * as before this field was introduced.
 */
export function verifyAdminPassword(password: string): AdminRole | null {
  if (password === getSecret()) return "manager";
  const staffPassword = process.env.STAFF_PASSWORD;
  if (staffPassword && password === staffPassword) return "staff";
  return null;
}
