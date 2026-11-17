import type { Settings } from "./types.js";

export type SignupDecision = { allowed: true } | { allowed: false; message: string };

/** Pure sign-up rules so the trigger stays tiny and testable. */
export function evaluateSignup(
  settings: Pick<Settings, "signupMode" | "allowedEmailDomains">,
  email: string | undefined,
): SignupDecision {
  if (settings.signupMode !== "open") {
    return { allowed: false, message: "Sign-up is closed. Ask an administrator to invite you." };
  }
  const domains = settings.allowedEmailDomains.map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  if (domains.length === 0) return { allowed: true };
  const at = email?.lastIndexOf("@") ?? -1;
  const domain = at > 0 ? (email as string).slice(at + 1).toLowerCase() : "";
  if (domains.includes(domain)) return { allowed: true };
  return { allowed: false, message: `Sign-up is limited to these email domains: ${domains.join(", ")}.` };
}
