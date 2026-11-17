import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertFullConfig, FULL_CONFIG_ENV, getConfig } from "../src/lib/config.js";

const saved = { ...process.env };

beforeEach(() => {
  for (const name of FULL_CONFIG_ENV) delete process.env[name];
});

afterEach(() => {
  process.env = { ...saved };
});

describe("runtime config", () => {
  // Regression: the Cognito triggers only get TABLE_NAME. Reading config eagerly made every
  // self sign-up fail with "Missing required environment variable UPLOADS_BUCKET".
  it("lets a trigger read the table name with only TABLE_NAME set", () => {
    process.env.TABLE_NAME = "genie-dev-data";
    expect(getConfig().tableName).toBe("genie-dev-data");
    expect(() => getConfig().uploadsBucket).toThrow("UPLOADS_BUCKET");
  });

  it("reflects the current environment on each read", () => {
    process.env.TABLE_NAME = "a";
    expect(getConfig().tableName).toBe("a");
    process.env.TABLE_NAME = "b";
    expect(getConfig().tableName).toBe("b");
  });

  it("assertFullConfig lists every missing variable for the API and chat functions", () => {
    process.env.TABLE_NAME = "t";
    expect(() => assertFullConfig()).toThrow("UPLOADS_BUCKET, AUTH_PARAMETER_NAME, KNOWLEDGE_BASE_ID, DATA_SOURCE_ID");
    for (const name of FULL_CONFIG_ENV) process.env[name] = "x";
    expect(() => assertFullConfig()).not.toThrow();
  });

  it("defaults the optional values", () => {
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.EMAIL_OTP;
    expect(getConfig().allowedOrigin).toBe("*");
    expect(getConfig().emailOtp).toBe(false);
  });
});
