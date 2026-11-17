import { writeAudit } from "../lib/audit.js";
import type { AdminUserListResponse, InviteUserResponse, ResetPasswordResponse, UpdateUserResponse, UserSummary } from "../lib/api-types.js";
import { cognitoCall, deleteUser, inviteUser, listUsersPage, resetPassword, setAdmin, setEnabled, signOutUser, subFor } from "../lib/cognito-users.js";
import { updateItem } from "../lib/db.js";
import { removePending } from "../lib/pending.js";
import { clearProfileCache, TOMBSTONE_TTL_SECONDS } from "../lib/profile.js";
import { badRequest, decodeCursor, encodeCursor, forbidden, noContent, ok } from "../lib/http.js";
import { inviteUserSchema, parseJsonBody, updateUserSchema } from "../lib/schemas.js";
import type { AuthUser } from "../lib/types.js";
import { route } from "./router.js";

const MAX_FILTER_PAGES = 20;
const MIN_FILTERED_ITEMS = 20;

/** Suspend = profile status plus Cognito disable (so sign-in itself fails); active reverses both. */
async function applyStatus(username: string, status: "active" | "suspended"): Promise<void> {
  const sub = await cognitoCall(() => subFor(username));
  await cognitoCall(() => setEnabled(username, status === "active"));
  if (status === "suspended") await cognitoCall(() => signOutUser(username)); // revoke refresh tokens too
  await updateItem(`USER#${sub}`, "PROFILE", { set: { status } });
  await removePending(sub);
  clearProfileCache(sub);
}

export function isSelf(user: AuthUser, target: string): boolean {
  const t = target.toLowerCase();
  return t === user.sub.toLowerCase() || t === user.username.toLowerCase() || (user.email !== "" && t === user.email.toLowerCase());
}

export const adminUserRoutes = [
  route("GET", "/api/admin/users", async ({ query }) => {
    const status = query.status;
    if (status !== undefined && status !== "active" && status !== "pending" && status !== "suspended") {
      throw badRequest("status must be active, pending or suspended");
    }
    let token = decodeCursor<{ token: string }>(query.cursor)?.token;
    const items: UserSummary[] = [];
    // Profile status lives in DynamoDB, so a status filter walks Cognito pages until it has enough.
    for (let page = 0; page < (status ? MAX_FILTER_PAGES : 1); page++) {
      const result = await cognitoCall(() => listUsersPage(token));
      items.push(...result.items.filter((u) => !status || u.profileStatus === status));
      token = result.next;
      if (!token || (status && items.length >= MIN_FILTERED_ITEMS)) break;
    }
    return ok<AdminUserListResponse>({ items, nextCursor: token ? encodeCursor({ token }) : null });
  }, { admin: true }),

  route("POST", "/api/admin/users", async ({ user, rawBody }) => {
    const input = parseJsonBody(inviteUserSchema, rawBody);
    const created = await cognitoCall(() => inviteUser(input.email.toLowerCase(), input.role));
    await writeAudit(user, "user.invite", input.email, { role: input.role });
    return { status: 201, body: { user: created } satisfies InviteUserResponse };
  }, { admin: true }),

  route("PATCH", "/api/admin/users/{username}", async ({ user, params, rawBody }) => {
    const input = parseJsonBody(updateUserSchema, rawBody);
    const username = params.username as string;
    if (isSelf(user, username) && (input.role === "user" || input.status === "suspended")) {
      throw forbidden("You cannot remove your own admin role or suspend your own account");
    }
    if (input.role) await cognitoCall(() => setAdmin(username, input.role === "admin"));
    if (input.status) await applyStatus(username, input.status);
    await writeAudit(user, "user.update", username, input);
    return ok<UpdateUserResponse>({ updated: true });
  }, { admin: true }),

  route("POST", "/api/admin/users/{username}/reset-password", async ({ user, params }) => {
    const username = params.username as string;
    await cognitoCall(() => resetPassword(username));
    await writeAudit(user, "user.reset-password", username);
    return ok<ResetPasswordResponse>({ reset: true });
  }, { admin: true }),

  route("DELETE", "/api/admin/users/{username}", async ({ user, params }) => {
    const username = params.username as string;
    if (isSelf(user, username)) throw forbidden("You cannot delete your own account");
    // Also how a pending sign-up is declined. Order matters: the tombstone goes first so the user's
    // still-valid ID token stops working immediately, then refresh tokens are revoked, then the account is removed.
    const sub = await cognitoCall(() => subFor(username));
    await updateItem(`USER#${sub}`, "PROFILE", {
      set: { status: "deleted", expiresAt: Math.floor(Date.now() / 1000) + TOMBSTONE_TTL_SECONDS },
    });
    clearProfileCache(sub);
    await cognitoCall(() => signOutUser(username));
    await cognitoCall(() => deleteUser(username));
    await removePending(sub);
    clearProfileCache(sub);
    await writeAudit(user, "user.delete", username);
    return noContent();
  }, { admin: true }),
];
