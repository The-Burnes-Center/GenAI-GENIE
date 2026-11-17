import { getItem, queryPartition } from "./db.js";
import { forbidden, notFound } from "./http.js";
import type { AuthUser, Workspace, WorkspaceDoc } from "./types.js";

const strip = <T extends object>(item: T): T => {
  const { PK: _pk, SK: _sk, ...rest } = item as T & { PK?: string; SK?: string };
  return rest as T;
};

export const canRead = (user: AuthUser, ws: Workspace) => ws.visibility === "shared" || ws.ownerSub === user.sub;
export const canManage = (user: AuthUser, ws: Workspace) => ws.ownerSub === user.sub || user.isAdmin;

export async function findWorkspace(workspaceId: string): Promise<Workspace | undefined> {
  const item = await getItem<Workspace>("WORKSPACES", `WS#${workspaceId}`);
  return item ? strip(item) : undefined;
}

/** Load a workspace the user may read. Hidden personal workspaces look like 404s. */
export async function requireReadable(user: AuthUser, workspaceId: string): Promise<Workspace> {
  const ws = await findWorkspace(workspaceId);
  if (!ws || !canRead(user, ws)) throw notFound("Workspace not found");
  return ws;
}

export async function requireManageable(user: AuthUser, workspaceId: string): Promise<Workspace> {
  const ws = await requireReadable(user, workspaceId);
  if (!canManage(user, ws)) throw forbidden("Only the owner or an admin can change this workspace");
  return ws;
}

export async function listVisibleWorkspaces(user: AuthUser): Promise<Workspace[]> {
  const all = await queryPartition<Workspace>("WORKSPACES", { skPrefix: "WS#" });
  return all
    .map(strip)
    .filter((w) => canRead(user, w))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listDocs(workspaceId: string): Promise<WorkspaceDoc[]> {
  const docs = await queryPartition<WorkspaceDoc>(`WS#${workspaceId}`, { skPrefix: "DOC#" });
  return docs.map(strip);
}
