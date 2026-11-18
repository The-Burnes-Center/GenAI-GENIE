import { TOMBSTONE_TTL_SECONDS } from "./limits.js";
import { getSettings } from "./catalog.js";
import { getItem, updateItem, writeListIfAllowed } from "./db.js";
import { HttpError } from "./http.js";
import { HINT_IDS, type AuthUser, type HintId, type ProfileStatus, type UserProfile } from "./types.js";

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

const isHintId = (value: unknown): value is HintId => (HINT_IDS as readonly unknown[]).includes(value);
const validHints = (value: unknown): HintId[] => (Array.isArray(value) ? value.filter(isHintId) : []);

/** Beginner tips already seen or dismissed. Read straight from the table (never the cache), so a change shows on the next load. */
export async function readHints(sub: string): Promise<HintId[]> {
  const { pk, sk } = profileKey(sub);
  return validHints((await getItem<UserProfile>(pk, sk))?.hints);
}

/**
 * A write the table refused. A profile that is pending, suspended or deleted is refused by the status
 * check (the middleware should have caught it; the cache can be up to 60 s old). Otherwise the write was refused
 * because nothing needed doing, so the current list is the answer.
 */
async function afterRefusedWrite(sub: string): Promise<HintId[]> {
  const { pk, sk } = profileKey(sub);
  const profile = await getItem<UserProfile>(pk, sk);
  if (profile) assertStatusAllowed(profile.status);
  return validHints(profile?.hints);
}

/** Idempotent: a tip already in the list is not added twice. A missing profile is created as active. */
export async function addHint(sub: string, email: string, hint: HintId, now = new Date()): Promise<HintId[]> {
  const { pk, sk } = profileKey(sub);
  const item = await writeListIfAllowed({
    pk,
    sk,
    field: "hints",
    value: hint,
    ifMissing: { status: "active", email, createdAt: now.toISOString() },
    guard: { field: "status", allowed: "active" },
  });
  return item ? validHints(item.hints) : afterRefusedWrite(sub);
}

/** Removes every dismissed tip. Never creates a profile: a missing one has nothing to clear. */
export async function clearHints(sub: string): Promise<void> {
  const { pk, sk } = profileKey(sub);
  const item = await writeListIfAllowed({ pk, sk, field: "hints", guard: { field: "status", allowed: "active" } });
  if (!item) await afterRefusedWrite(sub);
}

export { TOMBSTONE_TTL_SECONDS };
