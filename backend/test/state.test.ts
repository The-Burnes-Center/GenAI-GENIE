import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, Record<string, unknown>>();
const getItem = vi.fn(async (pk: string, sk: string) => store.get(`${pk}|${sk}`));
const putItem = vi.fn(async (item: Record<string, unknown>, opts: { ifNotExists?: boolean } = {}) => {
  const key = `${item.PK}|${item.SK}`;
  if (opts.ifNotExists && store.has(key)) return false;
  store.set(key, item);
  return true;
});
const queryPartition = vi.fn(async (pk: string, opts: { skPrefix?: string } = {}) =>
  [...store.entries()].filter(([k]) => k.startsWith(`${pk}|${opts.skPrefix ?? ""}`)).map(([, v]) => v),
);
const batchPut = vi.fn(async (items: Record<string, unknown>[]) => {
  for (const i of items) store.set(`${i.PK}|${i.SK}`, i);
});
const updateItem = vi.fn(async () => undefined);

vi.mock("../src/lib/db.js", () => ({
  getItem, putItem, queryPartition, batchPut, updateItem, deleteItem: vi.fn(), batchDelete: vi.fn(),
}));

const { getModel, getSettings, listModels, listTemplates } = await import("../src/lib/catalog.js");
const { DEFAULT_MODELS, DEFAULT_SETTINGS, DEFAULT_TEMPLATES } = await import("../src/lib/defaults.js");
const { assertStatusAllowed, clearProfileCache, loadProfile, resolveStatus } = await import("../src/lib/profile.js");

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  clearProfileCache();
});

describe("seed on first read", () => {
  it("seeds settings once and returns defaults", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(store.get("CONFIG|SETTINGS")).toMatchObject({ appName: "Genie" });
    await getSettings();
    expect(putItem).toHaveBeenCalledTimes(1);
  });

  it("merges defaults under stored settings so new fields always exist", async () => {
    store.set("CONFIG|SETTINGS", { PK: "CONFIG", SK: "SETTINGS", appName: "Custom" });
    const s = await getSettings();
    expect(s.appName).toBe("Custom");
    expect(s.retrievalTopK).toBe(15);
    expect(s).not.toHaveProperty("PK");
  });

  it("seeds the model catalog and templates on first list", async () => {
    const models = await listModels();
    expect(models).toHaveLength(DEFAULT_MODELS.length);
    expect(models[0]?.modelId).toBe("us.anthropic.claude-haiku-5-5");
    expect(models.every((m) => !("PK" in m))).toBe(true);
    expect((await listTemplates()).length).toBe(DEFAULT_TEMPLATES.length);
    expect(store.has("CONFIG|SEEDED#MODEL")).toBe(true);
  });

  it("does not reseed after an admin deletes everything", async () => {
    await listModels();
    for (const k of [...store.keys()]) if (k.startsWith("CONFIG|MODEL#")) store.delete(k);
    expect(await listModels()).toEqual([]);
  });

  it("getModel finds seeded entries on a fresh table", async () => {
    expect((await getModel("deepseek.v3.2"))?.label).toBe("DeepSeek V3.2");
    expect(await getModel("nope")).toBeUndefined();
  });
});

describe("profile status gating", () => {
  const user = { sub: "u1", email: "u@x.org", username: "u1", isAdmin: false, status: "active" as const };

  it("a missing profile is pending when approval is required, unless the user is an admin", async () => {
    await expect(resolveStatus(user)).rejects.toMatchObject({ code: "PENDING_APPROVAL" });
    clearProfileCache();
    expect(await resolveStatus({ ...user, isAdmin: true })).toBe("active");
  });

  it("a missing profile is active when approval is not required", async () => {
    store.set("CONFIG|SETTINGS", { PK: "CONFIG", SK: "SETTINGS", requireApproval: false });
    expect(await resolveStatus(user)).toBe("active");
  });

  it("a profile row without a status (created by last-seen tracking) falls back to the default rule", async () => {
    store.set("USER#u1|PROFILE", { email: "u@x.org", lastSeenAt: "t" });
    await expect(resolveStatus(user)).rejects.toMatchObject({ code: "PENDING_APPROVAL" });
  });

  it("does not write defaults when read for a trigger (seed: false)", async () => {
    await getSettings({ seed: false });
    expect(putItem).not.toHaveBeenCalled();
  });

  it("blocks pending with PENDING_APPROVAL and suspended with SUSPENDED", async () => {
    store.set("USER#u1|PROFILE", { status: "pending" });
    await expect(resolveStatus(user)).rejects.toMatchObject({ code: "PENDING_APPROVAL", status: 403 });
    clearProfileCache();
    store.set("USER#u1|PROFILE", { status: "suspended" });
    await expect(resolveStatus(user)).rejects.toMatchObject({ code: "SUSPENDED", status: 403 });
  });

  it("caches the profile for 60 seconds", async () => {
    store.set("USER#u1|PROFILE", { status: "active" });
    await loadProfile("u1", 1_000);
    store.set("USER#u1|PROFILE", { status: "suspended" });
    expect((await loadProfile("u1", 30_000))?.status).toBe("active");
    expect((await loadProfile("u1", 62_000))?.status).toBe("suspended");
    expect(getItem).toHaveBeenCalledTimes(2);
  });

  it("assertStatusAllowed passes active", () => {
    expect(() => assertStatusAllowed("active")).not.toThrow();
  });

  it("records last seen at most every five minutes", async () => {
    store.set("USER#u1|PROFILE", { status: "active" });
    await resolveStatus(user, 1_000_000);
    await resolveStatus(user, 1_060_000);
    expect(updateItem).toHaveBeenCalledTimes(1);
    await resolveStatus(user, 1_400_000);
    expect(updateItem).toHaveBeenCalledTimes(2);
  });
});
