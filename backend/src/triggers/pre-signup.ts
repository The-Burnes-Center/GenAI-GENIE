import type { PreSignUpTriggerEvent } from "aws-lambda";
import { getSettings } from "../lib/catalog.js";
import { evaluateSignup } from "../lib/signup.js";

/** Cognito rejects the sign-up when this throws; the message is shown to the user. */
export const handler = async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> => {
  // Admin-created users (invites) bypass the sign-up policy.
  if (event.triggerSource === "PreSignUp_AdminCreateUser") return event;
  const decision = evaluateSignup(await getSettings({ seed: false }), event.request.userAttributes.email);
  if (!decision.allowed) throw new Error(decision.message);
  return event;
};
