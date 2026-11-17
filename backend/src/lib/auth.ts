import { CognitoJwtVerifier } from "aws-jwt-verify";
import { getAuthParams } from "./config.js";
import { forbidden, unauthorized } from "./http.js";
import type { AuthUser } from "./types.js";

export const ADMIN_GROUP = "admin";

/** Minimal contract so tests can inject a fake verifier. */
export interface TokenVerifier {
  verify(token: string): Promise<Record<string, unknown>>;
}

let verifier: TokenVerifier | undefined;

async function defaultVerifier(): Promise<TokenVerifier> {
  if (verifier) return verifier;
  const { userPoolId, userPoolClientId } = await getAuthParams();
  verifier = CognitoJwtVerifier.create({ userPoolId, clientId: userPoolClientId, tokenUse: "id" }) as unknown as TokenVerifier;
  return verifier;
}

/** `cognito:groups` is an array in ID tokens, but tolerate a lone string. */
export function parseGroups(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((g): g is string => typeof g === "string");
  if (typeof value === "string") return [value];
  return [];
}

export function extractBearer(headers: Record<string, string | undefined>): string | undefined {
  const header = Object.entries(headers).find(([k]) => k.toLowerCase() === "authorization")?.[1];
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}

export async function authenticate(
  headers: Record<string, string | undefined>,
  tokenVerifier?: TokenVerifier,
): Promise<AuthUser> {
  const token = extractBearer(headers);
  if (!token) throw unauthorized();
  let claims: Record<string, unknown>;
  try {
    claims = await (tokenVerifier ?? (await defaultVerifier())).verify(token);
  } catch {
    throw unauthorized("Your session is invalid or expired");
  }
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  if (!sub) throw unauthorized("Your session is invalid or expired");
  // An unverified address could be spoofed to match an allowed domain or an admin invite.
  if (claims.email_verified !== true && claims.email_verified !== "true") {
    throw forbidden("Your email address is not verified. Verify it, then sign in again.");
  }
  const email = typeof claims.email === "string" ? claims.email : "";
  const username = typeof claims["cognito:username"] === "string" ? (claims["cognito:username"] as string) : sub;
  return { sub, email, username, status: "active", isAdmin: parseGroups(claims["cognito:groups"]).includes(ADMIN_GROUP) };
}

export function requireAdmin(user: AuthUser): void {
  if (!user.isAdmin) throw forbidden("Administrator access required");
}
