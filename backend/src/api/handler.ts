import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { assertFullConfig, getConfig } from "../lib/config.js";
import { adminConfigRoutes } from "./admin-config.js";
import { assistRoutes } from "./assist.js";
import { adminReportRoutes } from "./admin-reports.js";
import { adminUserRoutes } from "./admin-users.js";
import { meRoutes } from "./me.js";
import { handleRequest, type Route } from "./router.js";
import { sessionRoutes } from "./sessions.js";
import { uploadRoutes } from "./uploads.js";
import { workspaceRoutes } from "./workspaces.js";

export const routes: Route[] = [
  ...meRoutes,
  ...assistRoutes,
  ...sessionRoutes,
  ...uploadRoutes,
  ...workspaceRoutes,
  ...adminUserRoutes,
  ...adminConfigRoutes,
  ...adminReportRoutes,
];

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  assertFullConfig();
  return handleRequest(event, { routes, allowedOrigin: getConfig().allowedOrigin });
}
