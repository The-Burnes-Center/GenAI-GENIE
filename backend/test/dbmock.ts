import { vi } from "vitest";
import type { ListWrite } from "../src/lib/db.js";

type Item = Record<string, unknown>;
export const store = new Map<string, Item>();
const key = (pk: string, sk: string) => `${pk}\u0000${sk}`;

export const dbMockModule = {
  getItem: vi.fn(async (pk: string, sk: string) => store.get(key(pk, sk))),
  putItem: vi.fn(async (item: Item, opts: { ifNotExists?: boolean } = {}) => {
    const k = key(String(item.PK), String(item.SK));
    if (opts.ifNotExists && store.has(k)) return false;
    store.set(k, { ...item });
    return true;
  }),
  deleteItem: vi.fn(async (pk: string, sk: string) => void store.delete(key(pk, sk))),
  deleteItemIfExists: vi.fn(async (pk: string, sk: string) => store.delete(key(pk, sk))),
  updateItem: vi.fn(async (pk: string, sk: string, spec: { set?: Item; add?: Record<string, number>; remove?: string[] }) => {
    const k = key(pk, sk);
    const cur: Item = store.get(k) ?? { PK: pk, SK: sk };
    for (const [f, v] of Object.entries(spec.set ?? {})) cur[f] = v;
    for (const [f, v] of Object.entries(spec.add ?? {})) cur[f] = Number(cur[f] ?? 0) + v;
    for (const f of spec.remove ?? []) delete cur[f];
    store.set(k, cur);
  }),
  queryPartition: vi.fn(async (pk: string, opts: { skPrefix?: string; ascending?: boolean; limit?: number } = {}) => {
    const rows = [...store.values()]
      .filter((i) => i.PK === pk && String(i.SK).startsWith(opts.skPrefix ?? ""))
      .sort((a, b) => String(a.SK).localeCompare(String(b.SK)));
    if (opts.ascending === false) rows.reverse();
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  }),
  queryPage: vi.fn(async (pk: string, opts: { size: number; startKey?: { SK: string }; ascending?: boolean; keep?: (i: Item) => boolean }) => {
    let rows = [...store.values()].filter((i) => i.PK === pk).sort((a, b) => String(a.SK).localeCompare(String(b.SK)));
    if (opts.ascending !== true) rows.reverse();
    if (opts.startKey) {
      const k = opts.startKey.SK;
      rows = rows.filter((r) => (opts.ascending === true ? String(r.SK) > k : String(r.SK) < k));
    }
    const items: Item[] = [];
    for (const r of rows) {
      if (opts.keep && !opts.keep(r)) continue;
      items.push(r);
      if (items.length > opts.size) return { items: items.slice(0, opts.size), lastKey: { PK: items[opts.size - 1]!.PK, SK: items[opts.size - 1]!.SK } };
    }
    return { items };
  }),
  addIfBelow: vi.fn(async (pk: string, sk: string, field: string, amount: number, limit: number, extra: { set?: Item } = {}) => {
    const k = key(pk, sk);
    const cur: Item = store.get(k) ?? { PK: pk, SK: sk };
    if (Number(cur[field] ?? 0) > limit - amount) return false;
    cur[field] = Number(cur[field] ?? 0) + amount;
    Object.assign(cur, extra.set ?? {});
    store.set(k, cur);
    return true;
  }),
  /** Mirrors the real conditional write: refuses (undefined, no write) on a guard mismatch, a duplicate value, or a removal of a missing item. */
  writeListIfAllowed: vi.fn(async (spec: ListWrite): Promise<Item | undefined> => {
    const k = key(spec.pk, spec.sk);
    const cur = store.get(k);
    const guardValue = cur?.[spec.guard.field];
    if (guardValue !== undefined && guardValue !== spec.guard.allowed) return undefined;
    if (spec.value === undefined) {
      if (!cur) return undefined;
      const next: Item = { ...cur };
      delete next[spec.field];
      store.set(k, next);
      return { ...next };
    }
    const list = Array.isArray(cur?.[spec.field]) ? [...(cur?.[spec.field] as unknown[])] : [];
    if (list.includes(spec.value)) return undefined;
    const next: Item = { PK: spec.pk, SK: spec.sk, ...cur };
    for (const [field, value] of Object.entries(spec.ifMissing ?? {})) if (next[field] === undefined) next[field] = value;
    next[spec.field] = [...list, spec.value];
    store.set(k, next);
    return { ...next };
  }),
  batchPut: vi.fn(async (items: Item[]) => items.forEach((i) => store.set(key(String(i.PK), String(i.SK)), i))),
  batchDelete: vi.fn(async (keys: { PK: string; SK: string }[]) => keys.forEach((k) => store.delete(key(k.PK, k.SK)))),
};

export const resetDb = () => {
  store.clear();
  for (const fn of Object.values(dbMockModule)) fn.mockClear();
};
