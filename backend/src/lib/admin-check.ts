import { ADMIN_GROUP } from "./auth.js";
import { groupsFor } from "./cognito-users.js";
import type { AuthUser } from "./types.js";

export const ADMIN_CACHE_MS = 60_000;
const cache = new Map<string, { isAdmin: boolean; at: number }>();

export const clearAdminCache = () => cache.clear();

/**
 * The token says "admin" for up to its lifetime; Cognito says whether that is still true.
 * Cached for 60 s. If Cognito cannot be asked the answer is "unknown" (logged), and the caller decides:
 * read-only requests may fall back to the token's claim, mutations must not.
 */
export type AdminCheck = boolean | "unknown";

export async function confirmAdmin(
  user: Pick<AuthUser, "sub" | "username">,
  now = Date.now(),
  lookup: (username: string) => Promise<string[]> = groupsFor,
): Promise<AdminCheck> {
  const hit = cache.get(user.sub);
  if (hit && now - hit.at < ADMIN_CACHE_MS) return hit.isAdmin;
  try {
    const isAdmin = (await lookup(user.username)).includes(ADMIN_GROUP);
    cache.set(user.sub, { isAdmin, at: now });
    return isAdmin;
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "admin group check failed", error: String(err) }));
    return "unknown";
  }
}
