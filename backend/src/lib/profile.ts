import { TOMBSTONE_TTL_SECONDS } from "./limits.js";
import { getSettings } from "./catalog.js";
import { getItem, updateItem } from "./db.js";
import { HttpError } from "./http.js";
import type { AuthUser, ProfileStatus, UserProfile } from "./types.js";

export const PROFILE_CACHE_MS = 60_000;
const LAST_SEEN_EVERY_MS = 5 * 60_000;

const cache = new Map<string, { profile: UserProfile | undefined; at: number }>();
const lastSeenWritten = new Map<string, number>();

export const profileKey = (sub: string) => ({ pk: `USER#${sub}`, sk: "PROFILE" });

export function clearProfileCache(sub?: string): void {
  if (sub) cache.delete(sub);
  else {
    cache.clear();
    lastSeenWritten.clear();
  }
}

/** Profile for a user, cached in memory for 60 s. Missing profile (admin-created user) is `undefined`. */
export async function loadProfile(sub: string, now = Date.now()): Promise<UserProfile | undefined> {
  const hit = cache.get(sub);
  if (hit && now - hit.at < PROFILE_CACHE_MS) return hit.profile;
  const { pk, sk } = profileKey(sub);
  const profile = await getItem<UserProfile>(pk, sk);
  cache.set(sub, { profile, at: now });
  return profile;
}

/** Throws 403 PENDING_APPROVAL / SUSPENDED. A missing profile counts as active. */
export function assertStatusAllowed(status: ProfileStatus): void {
  if (status === "pending") throw new HttpError("PENDING_APPROVAL", "Your account is waiting for administrator approval.");
  if (status === "deleted") throw new HttpError("SUSPENDED", "This account no longer exists.");
  if (status === "suspended") throw new HttpError("SUSPENDED", "Your account has been suspended. Contact an administrator.");
}

/**
 * Status when there is no stored status: admins and open-approval installs are active; otherwise the
 * user is held as pending (this covers accounts created outside the app, e.g. in the Cognito console).
 */
export function defaultStatus(isAdmin: boolean, requireApproval: boolean): ProfileStatus {
  return isAdmin || !requireApproval ? "active" : "pending";
}

/** Load the profile status, enforce it, and record a (throttled) last-seen time. */
export async function resolveStatus(user: AuthUser, now = Date.now()): Promise<ProfileStatus> {
  const profile = await loadProfile(user.sub, now);
  const status = profile?.status ?? defaultStatus(user.isAdmin, (await getSettings({ seed: false })).requireApproval);
  assertStatusAllowed(status);
  if (now - (lastSeenWritten.get(user.sub) ?? 0) > LAST_SEEN_EVERY_MS) {
    lastSeenWritten.set(user.sub, now);
    const { pk, sk } = profileKey(user.sub);
    // Best effort: a failed write must not block the request.
    await updateItem(pk, sk, { set: { email: user.email, lastSeenAt: new Date(now).toISOString() } }).catch((err) =>
      console.error(JSON.stringify({ level: "error", message: "lastSeen update failed", error: String(err) })),
    );
  }
  return status;
}

export { TOMBSTONE_TTL_SECONDS };
