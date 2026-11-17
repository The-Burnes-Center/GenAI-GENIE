import { vi } from "vitest";

export interface Obj {
  bytes: Uint8Array;
  contentType?: string;
}
export const objects = new Map<string, Obj>();
export const s3Calls: { name: string; input: Record<string, any> }[] = [];

export const s3Send = vi.fn(async (cmd: { constructor: { name: string }; input: Record<string, any> }) => {
  const name = cmd.constructor.name;
  s3Calls.push({ name, input: cmd.input });
  if (name === "GetObjectCommand") {
    const obj = objects.get(cmd.input.Key);
    if (!obj) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
    return {
      Body: { transformToByteArray: async () => obj.bytes, transformToString: async () => Buffer.from(obj.bytes).toString("utf8") },
      ContentType: obj.contentType,
      ContentLength: obj.bytes.length,
      ContentRange: `bytes 0-${obj.bytes.length - 1}/${obj.bytes.length}`,
    };
  }
  if (name === "HeadObjectCommand") {
    const obj = objects.get(cmd.input.Key);
    if (!obj) throw Object.assign(new Error("missing"), { name: "NotFound" });
    return { ContentLength: obj.bytes.length, ETag: '"etag"' };
  }
  if (name === "ListObjectsV2Command") return { Contents: [] };
  return {};
});

export const awsMockModule = {
  s3: () => ({ send: s3Send }),
  bedrockRuntime: () => ({ send: vi.fn() }),
  bedrock: () => ({ send: vi.fn() }),
  bedrockAgent: () => ({ send: vi.fn() }),
  bedrockAgentRuntime: () => ({ send: vi.fn() }),
  cognito: () => ({ send: vi.fn() }),
};

export const resetS3 = () => {
  objects.clear();
  s3Calls.length = 0;
  s3Send.mockClear();
};

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
export const PDF = new TextEncoder().encode("%PDF-1.4 fake");
export const TXT = (s: string) => new TextEncoder().encode(s);
