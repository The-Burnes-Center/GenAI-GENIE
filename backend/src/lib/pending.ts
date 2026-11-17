import { deleteItem, putItem, queryPartition } from "./db.js";

// A small index of sign-ups awaiting approval, so the admin badge is one Query instead of a table scan.
const PK = "PENDING";

export const addPending = (sub: string, email: string) =>
  putItem({ PK, SK: sub, email, at: new Date().toISOString() });

export const removePending = (sub: string) => deleteItem(PK, sub);

export async function countPending(): Promise<number> {
  return (await queryPartition(PK)).length;
}
