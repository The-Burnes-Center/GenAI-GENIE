import type { RewriteResponse } from "../lib/api-types.js";
import { ok } from "../lib/http.js";
import { parseJsonBody, rewriteRequestSchema } from "../lib/schemas.js";
import { rewriteRequest } from "../lib/rewrite.js";
import { route } from "./router.js";

export const assistRoutes = [
  route("POST", "/api/assist/rewrite", async ({ user, rawBody }) => {
    const { text } = parseJsonBody(rewriteRequestSchema, rawBody);
    return ok<RewriteResponse>(await rewriteRequest(user, text));
  }),
];
