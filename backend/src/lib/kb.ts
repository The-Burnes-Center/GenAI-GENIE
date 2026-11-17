import { GetIngestionJobCommand, ListIngestionJobsCommand, StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";
import { RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { bedrockAgent, bedrockAgentRuntime } from "./aws.js";
import { getConfig } from "./config.js";
import { deleteItem, getItem, putItem, updateItem } from "./db.js";
import type { Source } from "./converse.js";
import type { Citation, DocStatus, WorkspaceDoc } from "./types.js";

const SNIPPET_CHARS = 300;

export const sidecarKey = (key: string) => `${key}.metadata.json`;

export function sidecarBody(workspaceId: string): string {
  return JSON.stringify({ metadataAttributes: { workspaceId } });
}

function titleFromUri(uri: string): string {
  const last = uri.split("/").pop() ?? uri;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** Top passages from one workspace, as client-facing citations and full source text for the prompt. */
export async function retrieveFromWorkspace(
  workspaceId: string,
  query: string,
  topK: number,
): Promise<{ citations: Citation[]; sources: Source[] }> {
  const out = await bedrockAgentRuntime().send(
    new RetrieveCommand({
      knowledgeBaseId: getConfig().knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: topK,
          filter: { equals: { key: "workspaceId", value: workspaceId } },
        },
      },
    }),
  );
  const citations: Citation[] = [];
  const sources: Source[] = [];
  for (const r of out.retrievalResults ?? []) {
    const text = r.content?.text?.trim();
    if (!text) continue;
    const uri = r.location?.s3Location?.uri ?? "";
    const title = titleFromUri(uri) || "Source";
    const documentId = uri.match(/\/workspaces\/[^/]+\/([^/]+)\//)?.[1];
    citations.push({ index: citations.length + 1, title, snippet: text.slice(0, SNIPPET_CHARS), workspaceId, ...(documentId ? { documentId } : {}) });
    sources.push({ title, text });
  }
  return { citations, sources };
}

const PENDING_KEY = { pk: "SYSTEM", sk: "REINDEX_PENDING" } as const;

/** Start an ingestion job. Returns undefined when one is already running. */
export async function startIngestion(): Promise<string | undefined> {
  const { knowledgeBaseId, dataSourceId } = getConfig();
  try {
    const out = await bedrockAgent().send(new StartIngestionJobCommand({ knowledgeBaseId, dataSourceId }));
    // A fresh job sees every change made so far, so any remembered reindex is covered.
    await deleteItem(PENDING_KEY.pk, PENDING_KEY.sk).catch(() => undefined);
    return out.ingestionJob?.ingestionJobId;
  } catch (err) {
    if ((err as Error).name === "ConflictException") return undefined;
    throw err;
  }
}

/** After a deletion: reindex now, or remember to once the running job finishes. */
export async function requestReindex(): Promise<void> {
  if ((await startIngestion()) === undefined) {
    await putItem({ PK: PENDING_KEY.pk, SK: PENDING_KEY.sk, at: new Date().toISOString() });
  }
}

export const INGEST_PARTIAL_FAILURE = "Some documents could not be indexed. Try again.";

const RUNNING = new Set(["STARTING", "IN_PROGRESS", "STOPPING"]);

async function isJobRunning(): Promise<boolean> {
  const { knowledgeBaseId, dataSourceId } = getConfig();
  const out = await bedrockAgent().send(
    new ListIngestionJobsCommand({
      knowledgeBaseId,
      dataSourceId,
      maxResults: 1,
      sortBy: { attribute: "STARTED_AT", order: "DESCENDING" },
    }),
  );
  const latest = out.ingestionJobSummaries?.[0]?.status;
  return latest !== undefined && RUNNING.has(latest);
}

async function jobOutcome(jobId: string): Promise<{ status: DocStatus; error?: string }> {
  const { knowledgeBaseId, dataSourceId } = getConfig();
  const out = await bedrockAgent().send(new GetIngestionJobCommand({ knowledgeBaseId, dataSourceId, ingestionJobId: jobId }));
  const job = out.ingestionJob;
  if (job?.status === "COMPLETE") {
    // COMPLETE can still hide per-document failures; the statistics do not say which files, so the whole batch is suspect.
    const failed = job.statistics?.numberOfDocumentsFailed ?? 0;
    if (failed > 0) return { status: "failed", error: INGEST_PARTIAL_FAILURE };
    return { status: "ready" };
  }
  if (job?.status === "FAILED") return { status: "failed", error: (job.failureReasons ?? []).join("; ") || "Indexing failed" };
  return { status: "indexing" };
}

/**
 * Bring document statuses in line with their ingestion jobs. Documents still
 * `uploaded` (a job was already running when they were added) get a fresh job
 * once the running one finishes. Persists changes and returns the updated list.
 */
export async function refreshDocStatuses(workspaceId: string, docs: WorkspaceDoc[]): Promise<WorkspaceDoc[]> {
  if ((await getItem(PENDING_KEY.pk, PENDING_KEY.sk)) && !(await isJobRunning())) await startIngestion();
  const outcomes = new Map<string, { status: DocStatus; error?: string }>();
  let retryJobId: string | undefined;
  let retried = false;

  const refreshed: WorkspaceDoc[] = [];
  for (const d of docs) {
    let next: WorkspaceDoc = d;
    if (d.status === "uploaded" && !retried) {
      retried = true;
      if (!(await isJobRunning())) retryJobId = await startIngestion();
    }
    if (d.status === "uploaded" && retryJobId) {
      next = { ...d, status: "indexing", ingestionJobId: retryJobId };
    } else if (d.status === "indexing" && d.ingestionJobId) {
      const outcome = outcomes.get(d.ingestionJobId) ?? (await jobOutcome(d.ingestionJobId));
      outcomes.set(d.ingestionJobId, outcome);
      next = { ...d, status: outcome.status, ...(outcome.error ? { error: outcome.error } : {}) };
    }
    if (next !== d) {
      await updateItem(`WS#${workspaceId}`, `DOC#${d.docId}`, {
        set: { status: next.status, ...(next.ingestionJobId ? { ingestionJobId: next.ingestionJobId } : {}), ...(next.error ? { error: next.error } : {}) },
      });
    }
    refreshed.push(next);
  }
  return refreshed;
}
