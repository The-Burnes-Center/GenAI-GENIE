import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getConfig } from "./config.js";

export type Item = Record<string, unknown>;

let client: DynamoDBDocumentClient | undefined;
const doc = () =>
  (client ??= DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }));
const table = () => getConfig().tableName;

export async function getItem<T = Item>(pk: string, sk: string): Promise<T | undefined> {
  const out = await doc().send(new GetCommand({ TableName: table(), Key: { PK: pk, SK: sk } }));
  return out.Item as T | undefined;
}

/** Returns false when `ifNotExists` was set and the item already exists. */
export async function putItem(item: Item, opts: { ifNotExists?: boolean } = {}): Promise<boolean> {
  try {
    await doc().send(
      new PutCommand({
        TableName: table(),
        Item: item,
        ...(opts.ifNotExists ? { ConditionExpression: "attribute_not_exists(PK)" } : {}),
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

export async function deleteItem(pk: string, sk: string): Promise<void> {
  await doc().send(new DeleteCommand({ TableName: table(), Key: { PK: pk, SK: sk } }));
}

/** Delete and report whether the item existed (atomic): the winner of a race gets true, everyone else false. */
export async function deleteItemIfExists(pk: string, sk: string): Promise<boolean> {
  try {
    await doc().send(new DeleteCommand({ TableName: table(), Key: { PK: pk, SK: sk }, ConditionExpression: "attribute_exists(PK)" }));
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

export interface UpdateSpec {
  set?: Item;
  add?: Record<string, number>;
  remove?: string[];
}

/** Update with SET / ADD / REMOVE clauses built from plain objects. */
export async function updateItem(pk: string, sk: string, spec: UpdateSpec): Promise<void> {
  const names: Record<string, string> = {};
  const values: Item = {};
  const clauses: string[] = [];
  const part = (verb: string, entries: [string, unknown][], fmt: (n: string, v: string) => string) => {
    if (entries.length === 0) return;
    const parts = entries.map(([key, value], i) => {
      names[`#${verb}${i}`] = key;
      values[`:${verb}${i}`] = value;
      return fmt(`#${verb}${i}`, `:${verb}${i}`);
    });
    clauses.push(`${verb.toUpperCase()} ${parts.join(", ")}`);
  };
  part("set", Object.entries(spec.set ?? {}), (n, v) => `${n} = ${v}`);
  part("add", Object.entries(spec.add ?? {}), (n, v) => `${n} ${v}`);
  const removals = spec.remove ?? [];
  if (removals.length > 0) {
    removals.forEach((key, i) => (names[`#rm${i}`] = key));
    clauses.push(`REMOVE ${removals.map((_, i) => `#rm${i}`).join(", ")}`);
  }
  if (clauses.length === 0) return;
  await doc().send(
    new UpdateCommand({
      TableName: table(),
      Key: { PK: pk, SK: sk },
      UpdateExpression: clauses.join(" "),
      ExpressionAttributeNames: names,
      ...(Object.keys(values).length > 0 ? { ExpressionAttributeValues: values } : {}),
    }),
  );
}

export interface PageResult<T> {
  items: T[];
  /** Key of the last row returned, set only when more rows follow. */
  lastKey?: Record<string, unknown>;
}

/**
 * One true page: read until `size` rows match `keep` (or the partition ends) and hand back the
 * DynamoDB key to resume from. Newest-first by default.
 */
export async function queryPage<T extends Item>(
  pk: string,
  opts: { size: number; startKey?: Record<string, unknown> | undefined; ascending?: boolean; keep?: (item: T) => boolean },
): Promise<PageResult<T>> {
  const items: T[] = [];
  let startKey = opts.startKey;
  for (;;) {
    const out = await doc().send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: opts.ascending ?? false,
        Limit: Math.max(opts.size + 1 - items.length, 25),
        ExclusiveStartKey: startKey,
      }),
    );
    for (const row of (out.Items ?? []) as T[]) {
      if (opts.keep && !opts.keep(row)) continue;
      items.push(row);
      // One extra row proves there is a next page, so an exact multiple does not end on an empty page.
      if (items.length > opts.size) {
        const last = items[opts.size - 1] as T;
        return { items: items.slice(0, opts.size), lastKey: { PK: last.PK, SK: last.SK } };
      }
    }
    startKey = out.LastEvaluatedKey;
    if (!startKey) return { items };
  }
}

export interface QueryOptions {
  skPrefix?: string;
  /** Newest-first when false. Defaults to true (ascending SK). */
  ascending?: boolean;
  limit?: number;
  filter?: { expression: string; names?: Record<string, string>; values?: Item };
}

/** Query a partition, following pages until `limit` items (default: everything). */
export async function queryPartition<T = Item>(pk: string, opts: QueryOptions = {}): Promise<T[]> {
  const results: T[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const out = await doc().send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: opts.skPrefix ? "PK = :pk AND begins_with(SK, :sk)" : "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk, ...(opts.skPrefix ? { ":sk": opts.skPrefix } : {}), ...opts.filter?.values },
        ...(opts.filter?.names ? { ExpressionAttributeNames: opts.filter.names } : {}),
        ...(opts.filter ? { FilterExpression: opts.filter.expression } : {}),
        ScanIndexForward: opts.ascending ?? true,
        ExclusiveStartKey: startKey,
      }),
    );
    results.push(...((out.Items ?? []) as T[]));
    startKey = out.LastEvaluatedKey;
  } while (startKey && (opts.limit === undefined || results.length < opts.limit));
  return opts.limit === undefined ? results : results.slice(0, opts.limit);
}

const BATCH_SIZE = 25;

async function batchWrite(requests: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    let pending = requests.slice(i, i + BATCH_SIZE);
    // Retry unprocessed items a few times; throttling returns them rather than failing.
    for (let attempt = 0; pending.length > 0 && attempt < 5; attempt++) {
      const out = await doc().send(new BatchWriteCommand({ RequestItems: { [table()]: pending as never } }));
      pending = (out.UnprocessedItems?.[table()] ?? []) as Record<string, unknown>[];
      if (pending.length > 0) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
    }
    if (pending.length > 0) throw new Error("DynamoDB batch write left unprocessed items");
  }
}

export const batchDelete = (keys: { PK: string; SK: string }[]) =>
  batchWrite(keys.map((Key) => ({ DeleteRequest: { Key } })));

export const batchPut = (items: Item[]) => batchWrite(items.map((Item) => ({ PutRequest: { Item } })));

/**
 * Atomically add to `counter` only while it stays below `limit`. Returns false when the limit is hit.
 * `extraAdd` and `set` ride in the same UpdateItem so the counter and any totals stay consistent.
 */
export async function addIfBelow(pk: string, sk: string, field: string, amount: number, limit: number, extra: UpdateSpec = {}): Promise<boolean> {
  try {
    await doc().send(
      new UpdateCommand({
        TableName: table(),
        Key: { PK: pk, SK: sk },
        UpdateExpression: "ADD #f :n" + (extra.set ? " SET " + Object.keys(extra.set).map((_, i) => `#s${i} = :s${i}`).join(", ") : ""),
        ConditionExpression: "attribute_not_exists(#f) OR #f <= :max",
        ExpressionAttributeNames: { "#f": field, ...Object.fromEntries(Object.keys(extra.set ?? {}).map((k, i) => [`#s${i}`, k])) },
        ExpressionAttributeValues: { ":n": amount, ":max": limit - amount, ...Object.fromEntries(Object.values(extra.set ?? {}).map((v, i) => [`:s${i}`, v])) },
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}
