import { z } from "zod";
import { badRequest } from "./http.js";
import { HINT_IDS } from "./types.js";
import { isValidTimezone } from "./tz.js";

export const MAX_PROMPT_CHARS = 400_000;
export const MAX_ATTACHMENTS = 25; // 5 documents + 20 images, checked by kind in converse.ts
export const MAX_REWRITE_CHARS = 8000;

const attachmentSchema = z.object({
  key: z.string().min(1).max(1024),
  name: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  size: z.number().int().nonnegative(),
});

export const chatRequestSchema = z.object({
  sessionId: z.string().min(1).max(64).optional(),
  modelId: z.string().min(1).max(256),
  prompt: z.string().trim().min(1).max(MAX_PROMPT_CHARS, "That message is too long. Attach it as a file instead."),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).default([]),
  workspaceId: z.string().min(1).max(64).optional(),
  templateId: z.string().min(1).max(64).optional(),
  mode: z.enum(["chat", "compare"]).default("chat"),
  compareModelIds: z.array(z.string().min(1).max(256)).max(10).optional(),
  /** Client-sent 0-based turn number; compare sessions use it to pair answers. */
  turn: z.number().int().min(0).optional(),
  /** The assistant message being retried (a failed one, or the latest reply to regenerate); the server deletes that pair first. */
  retryOfMessageId: z.string().min(1).max(64).optional(),
  settings: z.object({ thinking: z.enum(["standard", "deep"]).optional() }).optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const renameSessionSchema = z.object({ title: z.string().trim().min(1).max(120) });

export const feedbackSchema = z.object({
  rating: z.enum(["up", "down"]),
  comment: z.string().trim().max(2000).optional(),
});

export const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().min(1).max(128),
  size: z.number().int().positive(),
  purpose: z.enum(["attachment", "workspace"]),
  workspaceId: z.string().min(1).max(64).optional(),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
  visibility: z.enum(["personal", "shared"]).default("personal"),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional(),
});

// contentType and size are accepted for compatibility but ignored: the server records them at presign time.
export const registerDocumentSchema = z.object({
  key: z.string().min(1).max(1024),
  name: z.string().trim().min(1).max(255),
  contentType: z.string().max(128).optional(),
  size: z.number().int().positive().optional(),
});

const roleSchema = z.enum(["user", "admin"]);

export const inviteUserSchema = z.object({ email: z.email().max(254), role: roleSchema.default("user") });

export const updateUserSchema = z
  .object({ role: roleSchema.optional(), status: z.enum(["active", "suspended"]).optional() })
  .refine((v) => v.role !== undefined || v.status !== undefined, { message: "Nothing to update" });

export const modelEntrySchema = z.object({
  label: z.string().trim().min(1).max(80),
  provider: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).default(""),
  enabled: z.boolean().default(true),
  capabilities: z
    .object({
      vision: z.boolean(),
      documents: z.boolean(),
      reasoning: z.boolean().default(false),
      temperature: z.boolean().default(false),
      promptCache: z.boolean().default(false),
    })
    .default({ vision: false, documents: false, reasoning: false, temperature: false, promptCache: false }),
  defaultTemperature: z.number().min(0).max(2).optional(),
  contextWindow: z.number().int().min(1000).max(10_000_000),
  maxOutputTokens: z.number().int().min(64).max(1_000_000),
  sortOrder: z.number().int().default(100),
});

/** Only https links: a stored link must never be able to point at a javascript: or plain http: target. */
function isHttpsUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const learnLinkSchema = z.object({
  title: z.string().trim().min(1).max(80),
  url: z.string().trim().max(500).refine(isHttpsUrl, "Enter a full link that starts with https://"),
  description: z.string().trim().max(200).optional(),
});

export const settingsSchema = z.object({
  appName: z.string().trim().min(1).max(60),
  welcomeTitle: z.string().trim().max(120),
  welcomeMessage: z.string().trim().max(600),
  disclaimer: z.string().trim().max(600),
  defaultModelId: z.string().min(1).max(256),
  dailyMessageLimit: z.number().int().min(0).max(100_000),
  maxCompareModels: z.number().int().min(2).max(6),
  titleModelId: z.string().min(1).max(256),
  signupMode: z.enum(["off", "open"]),
  allowedEmailDomains: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter domains like example.org")).max(50),
  requireApproval: z.boolean(),
  retrievalTopK: z.number().int().min(1).max(100),
  timezone: z.string().refine(isValidTimezone, "Enter an IANA time zone like America/New_York"),
  templateCategories: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
  assistantInstructions: z.string().trim().max(4000),
  dataRules: z.array(z.string().trim().min(1).max(200)).max(10),
  learnLinks: z.array(learnLinkSchema).max(8),
  helpContact: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success || isHttpsUrl(v), "Enter an email address or a link that starts with https://"),
});

export const templateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  category: z.string().trim().min(1).max(40).default("General"),
  systemPrompt: z.string().max(10_000).default(""),
  starterPrompt: z.string().max(10_000).default(""),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(100),
});

export function parseWith<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path.join(".");
  throw badRequest(`${path ? `${path}: ` : ""}${issue?.message ?? "Invalid request"}`);
}

export function parseJsonBody<T extends z.ZodType>(schema: T, raw: string | undefined | null): z.infer<T> {
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : {};
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return parseWith(schema, value);
}

export const hintSchema = z.object({ hint: z.enum(HINT_IDS) });

export const rewriteRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write the request you want help with first.")
    .max(MAX_REWRITE_CHARS, "That request is too long to rewrite. Shorten it or attach it as a file."),
});

export const forkSessionSchema = z.object({ modelId: z.string().min(1).max(256) });
export const reviewFeedbackSchema = z.object({ reviewed: z.boolean() });
