import type { PostConfirmationTriggerEvent } from "aws-lambda";
import { getSettings } from "../lib/catalog.js";
import { putItem } from "../lib/db.js";
import { addPending } from "../lib/pending.js";

/** Create the profile for a self-service sign-up: pending when approval is required. */
export const handler = async (event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent> => {
  // Skip confirmations that are not a fresh sign-up (e.g. forgot-password).
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") return event;
  const settings = await getSettings({ seed: false });
  const { sub } = event.request.userAttributes;
  const email = (event.request.userAttributes.email ?? "").toLowerCase();
  await putItem(
    {
      PK: `USER#${sub}`,
      SK: "PROFILE",
      email,
      status: settings.requireApproval ? "pending" : "active",
      createdAt: new Date().toISOString(),
    },
    { ifNotExists: true },
  );
  if (settings.requireApproval) await addPending(sub as string, email);
  return event;
};
