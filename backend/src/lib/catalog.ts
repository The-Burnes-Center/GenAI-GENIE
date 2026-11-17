import { OLD_RETRIEVAL_TOP_K, DEFAULT_MODELS, DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from "./defaults.js";
import { batchPut, getItem, putItem, queryPartition } from "./db.js";
import type { ModelEntry, Settings, Template } from "./types.js";

const CONFIG = "CONFIG";
const bySortOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

const stripKeys = <T extends object>(item: T): T => {
  const { PK: _pk, SK: _sk, ...rest } = item as T & { PK?: string; SK?: string };
  return rest as T;
};

/** Stored settings from before a default changed: an untouched old default moves to the new one on read. */
export function migrateSettings(s: Settings): Settings {
  return s.retrievalTopK === OLD_RETRIEVAL_TOP_K ? { ...s, retrievalTopK: DEFAULT_SETTINGS.retrievalTopK } : s;
}

/** With `seed: false` (Cognito triggers, which have read-only table access) defaults are returned but never written. */
export async function getSettings(opts: { seed?: boolean } = {}): Promise<Settings> {
  const existing = await getItem<Settings>(CONFIG, "SETTINGS");
  if (existing) return migrateSettings({ ...DEFAULT_SETTINGS, ...stripKeys(existing) });
  if (opts.seed === false) return DEFAULT_SETTINGS;
  await putItem({ PK: CONFIG, SK: "SETTINGS", ...DEFAULT_SETTINGS }, { ifNotExists: true });
  return DEFAULT_SETTINGS;
}

export const saveSettings = (settings: Settings) => putItem({ PK: CONFIG, SK: "SETTINGS", ...settings });

/**
 * List a config collection, seeding the defaults the first time it is read.
 * A marker item records that seeding happened, so an admin who deletes every
 * entry does not see the defaults come back.
 */
async function listSeeded<T extends { sortOrder: number }>(
  kind: "MODEL" | "TEMPLATE",
  defaults: T[],
  keyOf: (item: T) => string,
): Promise<T[]> {
  const items = await queryPartition<T>(CONFIG, { skPrefix: `${kind}#` });
  if (items.length > 0) return items.map(stripKeys).sort(bySortOrder);
  const markerSk = `SEEDED#${kind}`;
  if (await getItem(CONFIG, markerSk)) return [];
  await batchPut(defaults.map((d) => ({ PK: CONFIG, SK: `${kind}#${keyOf(d)}`, ...d })));
  await putItem({ PK: CONFIG, SK: markerSk, at: new Date().toISOString() }, { ifNotExists: true });
  return [...defaults].sort(bySortOrder);
}

export const listModels = (): Promise<ModelEntry[]> => listSeeded("MODEL", DEFAULT_MODELS, (m) => m.modelId);

export const listTemplates = (): Promise<Template[]> => listSeeded("TEMPLATE", DEFAULT_TEMPLATES, (t) => t.templateId);

export async function getModel(modelId: string): Promise<ModelEntry | undefined> {
  const key = `MODEL#${modelId}`;
  let item = await getItem<ModelEntry>(CONFIG, key);
  if (!item) {
    await listModels(); // a fresh table seeds here
    item = await getItem<ModelEntry>(CONFIG, key);
  }
  return item ? stripKeys(item) : undefined;
}

export async function getTemplate(templateId: string): Promise<Template | undefined> {
  const key = `TEMPLATE#${templateId}`;
  let item = await getItem<Template>(CONFIG, key);
  if (!item) {
    await listTemplates();
    item = await getItem<Template>(CONFIG, key);
  }
  return item ? stripKeys(item) : undefined;
}

export const saveModel = (model: ModelEntry) => putItem({ PK: CONFIG, SK: `MODEL#${model.modelId}`, ...model });
export const saveTemplate = (template: Template) =>
  putItem({ PK: CONFIG, SK: `TEMPLATE#${template.templateId}`, ...template });
