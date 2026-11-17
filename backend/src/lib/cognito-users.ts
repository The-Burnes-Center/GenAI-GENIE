import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminUserGlobalSignOutCommand,
  AdminEnableUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminResetUserPasswordCommand,
  ListUsersCommand,
  ListUsersInGroupCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognito } from "./aws.js";
import { ADMIN_GROUP } from "./auth.js";
import { getAuthParams } from "./config.js";
import { getSettings } from "./catalog.js";
import { getItem, putItem } from "./db.js";
import { defaultStatus } from "./profile.js";
import { badRequest, conflict, HttpError, notFound } from "./http.js";
import type { UserSummary } from "./api-types.js";

export type { UserSummary };
import type { ProfileStatus, UserProfile } from "./types.js";

// The pool id comes from SSM at cold start (see config.ts), so every call awaits it.
const pool = async () => (await getAuthParams()).userPoolId;
const PAGE = 60;

export function toSummary(u: UserType, admins: Set<string>, profile?: UserProfile, requireApproval = true): UserSummary {
  const email = u.Attributes?.find((a) => a.Name === "email")?.Value ?? "";
  const username = u.Username ?? "";
  return {
    username,
    sub: u.Attributes?.find((a) => a.Name === "sub")?.Value ?? username,
    email,
    cognitoStatus: u.UserStatus ?? "UNKNOWN",
    profileStatus: profile?.status ?? defaultStatus(admins.has(username), requireApproval),
    ...(profile?.lastSeenAt ? { lastSeenAt: profile.lastSeenAt } : {}),
    enabled: u.Enabled ?? true,
    isAdmin: admins.has(username),
    createdAt: u.UserCreateDate?.toISOString(),
    lastModified: u.UserLastModifiedDate?.toISOString(),
  };
}

export async function adminUsernames(): Promise<Set<string>> {
  const names = new Set<string>();
  let token: string | undefined;
  do {
    const out = await cognito().send(new ListUsersInGroupCommand({ UserPoolId: await pool(), GroupName: ADMIN_GROUP, NextToken: token }));
    for (const u of out.Users ?? []) if (u.Username) names.add(u.Username);
    token = out.NextToken;
  } while (token);
  return names;
}

export async function listUsersPage(token: string | undefined): Promise<{ items: UserSummary[]; next?: string }> {
  const [out, admins] = await Promise.all([
    cognito().send(new ListUsersCommand({ UserPoolId: await pool(), Limit: PAGE, PaginationToken: token })),
    adminUsernames(),
  ]);
  const users = out.Users ?? [];
  const requireApproval = (await getSettings({ seed: false })).requireApproval;
  const profiles = await Promise.all(
    users.map((u) => getItem<UserProfile>(`USER#${u.Attributes?.find((a) => a.Name === "sub")?.Value ?? u.Username}`, "PROFILE")),
  );
  const items = users
    .map((u, i) => toSummary(u, admins, profiles[i], requireApproval))
    .filter((u) => u.profileStatus !== "deleted"); // tombstones are not users
  return { items, next: out.PaginationToken };
}

/** The `sub` for a username or email, used to address the profile item. */
export async function subFor(username: string): Promise<string> {
  const out = await cognito().send(new AdminGetUserCommand({ UserPoolId: await pool(), Username: username }));
  return out.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? username;
}

/** Translate Cognito failures into the API's error shape. */
export async function cognitoCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const name = (err as Error).name;
    if (name === "UserNotFoundException") throw notFound("User not found");
    if (name === "UsernameExistsException") throw conflict("A user with that email already exists");
    if (name === "InvalidParameterException" || name === "InvalidPasswordException") throw badRequest((err as Error).message);
    throw err;
  }
}

export async function inviteUser(email: string, role: "user" | "admin"): Promise<UserSummary> {
  const out = await cognito().send(
    new AdminCreateUserCommand({
      UserPoolId: await pool(),
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
      ],
      DesiredDeliveryMediums: ["EMAIL"],
    }),
  );
  const username = out.User?.Username ?? email;
  if (role === "admin") await setAdmin(username, true);
  // Invited users are approved by definition: record that so they are not held as pending.
  const sub = out.User?.Attributes?.find((a) => a.Name === "sub")?.Value ?? username;
  const profile: UserProfile = { email, status: "active", createdAt: new Date().toISOString() };
  await putItem({ PK: `USER#${sub}`, SK: "PROFILE", ...profile });
  return toSummary(out.User ?? {}, new Set(role === "admin" ? [username] : []), profile);
}

export async function setAdmin(username: string, makeAdmin: boolean): Promise<void> {
  const input = { UserPoolId: await pool(), Username: username, GroupName: ADMIN_GROUP };
  await cognito().send(makeAdmin ? new AdminAddUserToGroupCommand(input) : new AdminRemoveUserFromGroupCommand(input));
}

export async function setEnabled(username: string, enabled: boolean) {
  const UserPoolId = await pool();
  return cognito().send(enabled ? new AdminEnableUserCommand({ UserPoolId, Username: username }) : new AdminDisableUserCommand({ UserPoolId, Username: username }));
}

export async function resetPassword(username: string) {
  return cognito().send(new AdminResetUserPasswordCommand({ UserPoolId: await pool(), Username: username }));
}

export async function deleteUser(username: string) {
  return cognito().send(new AdminDeleteUserCommand({ UserPoolId: await pool(), Username: username }));
}

/** Revoke refresh tokens so a suspended or removed user cannot silently renew a session. */
export async function signOutUser(username: string) {
  return cognito().send(new AdminUserGlobalSignOutCommand({ UserPoolId: await pool(), Username: username }));
}

/** Live group membership, used to confirm admin rights instead of trusting a token for its full lifetime. */
export async function groupsFor(username: string): Promise<string[]> {
  const out = await cognito().send(new AdminListGroupsForUserCommand({ UserPoolId: await pool(), Username: username }));
  return (out.Groups ?? []).flatMap((g) => (g.GroupName ? [g.GroupName] : []));
}
