import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { authenticate } from "../lib/auth.js";
import { resolveStatus } from "../lib/profile.js";
import { corsHeaders, errorBody, HttpError, newRequestId } from "../lib/http.js";
import { assertFullConfig, getConfig } from "../lib/config.js";
import { type ChatEvent } from "../lib/ndjson.js";
import { createLineWriter } from "./line-writer.js";
import { runChat } from "./run.js";
import type { LambdaResponseStream } from "./awslambda.js";

const JSON_TYPE = "application/json";
const NDJSON_TYPE = "application/x-ndjson";

function writeJson(stream: LambdaResponseStream, status: number, body: unknown, cors: Record<string, string>) {
  const out = awslambda.HttpResponseStream.from(stream, { statusCode: status, headers: { "content-type": JSON_TYPE, ...cors } });
  out.write(body === undefined ? "" : JSON.stringify(body));
  out.end();
}

function decodeBody(event: APIGatewayProxyEventV2): string | undefined {
  if (!event.body) return undefined;
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream: LambdaResponseStream, context: Context) => {
    const requestId = newRequestId();
    assertFullConfig();
    const cors = corsHeaders(getConfig().allowedOrigin);
    if (event.requestContext.http.method === "OPTIONS") return writeJson(responseStream, 204, undefined, cors);
    if (event.requestContext.http.method !== "POST") {
      return writeJson(responseStream, 404, errorBody("NOT_FOUND", "Not found"), cors);
    }

    let user;
    try {
      const verified = await authenticate(event.headers ?? {});
      user = { ...verified, status: await resolveStatus(verified) };
    } catch (err) {
      const e = err instanceof HttpError ? err : new HttpError("UNAUTHORIZED", "Sign in required");
      return writeJson(responseStream, e.status, errorBody(e.code, e.message), cors);
    }

    const stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: { "content-type": NDJSON_TYPE, "cache-control": "no-store", ...cors },
    });
    const lines = createLineWriter(stream);
    try {
      await runChat({ user, rawBody: decodeBody(event), requestId, emit: (e: ChatEvent) => lines.emit(e), remainingMs: () => context.getRemainingTimeInMillis() });
    } finally {
      await lines.flush();
      stream.end();
    }
  },
);
