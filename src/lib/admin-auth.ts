export const ADMIN_COOKIE = "dcf_admin_session";

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

/** Session token proving the caller supplied the admin password, without embedding the password itself. */
export async function createAdminSessionToken(): Promise<string> {
  return sign("admin-session");
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expected = await createAdminSessionToken();
  return token === expected;
}

export function verifyAdminPassword(password: string): boolean {
  return password === getSecret();
}
