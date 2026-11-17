import { writeAudit } from "../lib/audit.js";
import { listAvailableModels, testModel } from "../lib/bedrock-models.js";
import { getModel, getSettings, getTemplate, listModels, listTemplates, saveModel, saveSettings, saveTemplate } from "../lib/catalog.js";
import { deleteItem } from "../lib/db.js";
import type { AdminModelsResponse, AdminSettingsResponse, ModelResponse, ModelTestResponse, SettingsResponse, TemplateListResponse, TemplateResponse } from "../lib/api-types.js";
import { badRequest, conflict, noContent, notFound, ok } from "../lib/http.js";
import { SETTINGS_HELP } from "../lib/defaults.js";
import { modelEntrySchema, parseJsonBody, settingsSchema, templateSchema } from "../lib/schemas.js";
import { route } from "./router.js";

const TEMPLATE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const admin = { admin: true } as const;

export const adminConfigRoutes = [
  route("GET", "/api/admin/models", async () => {
    const models = await listModels();
    return ok<AdminModelsResponse>({ items: models, available: await listAvailableModels(models) });
  }, admin),

  route("PUT", "/api/admin/models/{modelId}", async ({ user, params, rawBody }) => {
    const modelId = params.modelId as string;
    const input = parseJsonBody(modelEntrySchema, rawBody);
    const settings = await getSettings();
    if (modelId === settings.defaultModelId && !input.enabled) throw conflict("The default model cannot be disabled");
    const model = { modelId, ...input };
    await saveModel(model);
    await writeAudit(user, "model.upsert", modelId, { enabled: input.enabled, label: input.label });
    return ok<ModelResponse>({ model });
  }, admin),

  route("DELETE", "/api/admin/models/{modelId}", async ({ user, params }) => {
    const modelId = params.modelId as string;
    if (modelId === (await getSettings()).defaultModelId) throw conflict("The default model cannot be removed");
    if (!(await getModel(modelId))) throw notFound("Model not found");
    await deleteItem("CONFIG", `MODEL#${modelId}`);
    await writeAudit(user, "model.delete", modelId);
    return noContent();
  }, admin),

  route("POST", "/api/admin/models/{modelId}/test", async ({ params }) => {
    const modelId = params.modelId as string;
    if (!(await getModel(modelId))) throw notFound("Model not found");
    return ok<ModelTestResponse>(await testModel(modelId));
  }, admin),

  route("GET", "/api/admin/settings", async () => ok<AdminSettingsResponse>({ settings: await getSettings(), help: SETTINGS_HELP }), admin),

  route("PUT", "/api/admin/settings", async ({ user, rawBody }) => {
    const input = parseJsonBody(settingsSchema, rawBody);
    const model = await getModel(input.defaultModelId);
    if (!model?.enabled) throw badRequest("The default model must be an enabled catalog model");
    if (!(await getModel(input.titleModelId))) throw badRequest("The title model must be a catalog model");
    await saveSettings(input);
    await writeAudit(user, "settings.update", "settings", input);
    return ok<SettingsResponse>({ settings: input });
  }, admin),

  route("GET", "/api/admin/templates", async () => ok<TemplateListResponse>({ templates: await listTemplates() }), admin),

  route("PUT", "/api/admin/templates/{id}", async ({ user, params, rawBody }) => {
    const templateId = params.id as string;
    if (!TEMPLATE_ID.test(templateId)) throw badRequest("Template id must be lowercase letters, digits and hyphens");
    const template = { templateId, ...parseJsonBody(templateSchema, rawBody) };
    await saveTemplate(template);
    await writeAudit(user, "template.upsert", templateId, { title: template.title, enabled: template.enabled });
    return ok<TemplateResponse>({ template });
  }, admin),

  route("DELETE", "/api/admin/templates/{id}", async ({ user, params }) => {
    const templateId = params.id as string;
    if (!(await getTemplate(templateId))) throw notFound("Template not found");
    await deleteItem("CONFIG", `TEMPLATE#${templateId}`);
    await writeAudit(user, "template.delete", templateId);
    return noContent();
  }, admin),
];
