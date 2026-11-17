import { randomUUID } from "node:crypto";
import { putItem } from "./db.js";
import type { AuthUser } from "./types.js";

/**
 * Record an admin action (including denied attempts). A failed write never fails the request, but the
 * full audit record goes to the error log so it can be recovered from CloudWatch.
 */
export async function writeAudit(actor: AuthUser, action: string, target: string, details: Record<string, unknown> = {}): Promise<void> {
  try {
    await putItem({
      PK: "AUDIT",
      SK: `${new Date().toISOString()}#${randomUUID()}`,
      actorSub: actor.sub,
      actorEmail: actor.email,
      action,
      target,
      details,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "audit write failed",
        error: String(err),
        record: { at: new Date().toISOString(), actorSub: actor.sub, actorEmail: actor.email, action, target, details },
      }),
    );
  }
}
