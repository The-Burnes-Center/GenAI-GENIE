import { getSettings, listModels, listTemplates } from "../lib/catalog.js";
import { getConfig } from "../lib/config.js";
import { ok } from "../lib/http.js";
import { countPending } from "../lib/pending.js";
import { nextMidnight } from "../lib/tz.js";
import { countRequestsToday } from "../lib/usage.js";
import type { BootstrapResponse, MeResponse, PublicConfigResponse } from "../lib/api-types.js";
import type { AuthUser } from "../lib/types.js";
import { route } from "./router.js";

/** `pendingCount` is only meaningful (and only computed) for admins. */
async function describeMe(user: AuthUser): Promise<MeResponse> {
  return {
    sub: user.sub,
    email: user.email,
    isAdmin: user.isAdmin,
    ...(user.isAdmin ? { pendingCount: await countPending() } : {}),
  };
}

export const meRoutes = [
  route("GET", "/api/me", async ({ user }) => ok<MeResponse>(await describeMe(user))),

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
