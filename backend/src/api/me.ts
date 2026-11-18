import { getSettings, listModels, listTemplates } from "../lib/catalog.js";
import { getConfig } from "../lib/config.js";
import { ok } from "../lib/http.js";
import { addHint, clearHints, readHints } from "../lib/profile.js";
import { countPending } from "../lib/pending.js";
import { hintSchema, parseJsonBody } from "../lib/schemas.js";
import { nextMidnight } from "../lib/tz.js";
import { countRequestsToday } from "../lib/usage.js";
import type { BootstrapResponse, HintsResponse, MeResponse, PublicConfigResponse } from "../lib/api-types.js";
import type { AuthUser } from "../lib/types.js";
import { route } from "./router.js";

/** `pendingCount` is only meaningful (and only computed) for admins. */
async function describeMe(user: AuthUser): Promise<MeResponse> {
  return {
    sub: user.sub,
    email: user.email,
    isAdmin: user.isAdmin,
    hints: await readHints(user.sub),
    ...(user.isAdmin ? { pendingCount: await countPending() } : {}),
  };
}

export const meRoutes = [
  route("GET", "/api/me", async ({ user }) => ok<MeResponse>(await describeMe(user))),

  route("POST", "/api/me/hints", async ({ user, rawBody }) => {
    const { hint } = parseJsonBody(hintSchema, rawBody);
    return ok<HintsResponse>({ hints: await addHint(user.sub, user.email, hint) });
  }),

  // "Show beginner tips again".
  route("DELETE", "/api/me/hints", async ({ user }) => {
    await clearHints(user.sub);
    return ok<HintsResponse>({ hints: [] });
  }),

  route("GET", "/api/bootstrap", async ({ user }) => {
    const [settings, models, templates, me] = await Promise.all([getSettings(), listModels(), listTemplates(), describeMe(user)]);
    const used = await countRequestsToday(user.sub, settings.timezone);
    return ok<BootstrapResponse>({
      settings,
      models: models.filter((m) => m.enabled),
      templates: templates.filter((t) => t.enabled),
      me,
      usage: {
        used,
        limit: settings.dailyMessageLimit,
        resetsAt: nextMidnight(new Date(), settings.timezone).toISOString(),
      },
    });
  }),

  // Unauthenticated: the sign-in screen needs this before anyone has a token. Nothing else may be added here.
  route(
    "GET",
    "/api/public-config",
    async () => {
      const settings = await getSettings({ seed: false });
      const body: PublicConfigResponse = {
        appName: settings.appName,
        signupMode: settings.signupMode,
        allowedEmailDomains: settings.allowedEmailDomains,
        emailOtp: getConfig().emailOtp,
      };
      return {
        status: 200,
        headers: { "cache-control": "public, max-age=60" },
        body,
      };
    },
    { public: true },
  ),
];
