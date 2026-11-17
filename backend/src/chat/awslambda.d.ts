import type { Context } from "aws-lambda";
import type { Writable } from "node:stream";

/** The Lambda Node.js runtime injects `awslambda` as a global; it has no published types. */
interface LambdaResponseStream extends Writable {
  setContentType(contentType: string): void;
}

declare global {
  const awslambda: {
    streamifyResponse<E>(
      handler: (event: E, responseStream: LambdaResponseStream, context: Context) => Promise<void>,
    ): (event: E, context: Context) => Promise<void>;
    HttpResponseStream: {
      from(
        stream: LambdaResponseStream,
        metadata: { statusCode?: number; headers?: Record<string, string> },
      ): LambdaResponseStream;
    };
  };
}

export type { LambdaResponseStream };
