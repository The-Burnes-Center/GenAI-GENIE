import { describe, expect, it } from "vitest";
import { authenticate, extractBearer, parseGroups } from "../src/lib/auth.js";
import { HttpError } from "../src/lib/http.js";

const verifier = (claims: Record<string, unknown> | Error) => ({
  verify: async () => {
    if (claims instanceof Error) throw claims;
    return claims;
  },
});

describe("parseGroups", () => {
  it("handles arrays, a lone string and junk", () => {
    expect(parseGroups(["admin", "x"])).toEqual(["admin", "x"]);
    expect(parseGroups("admin")).toEqual(["admin"]);
    expect(parseGroups(undefined)).toEqual([]);
    expect(parseGroups([1, "a"])).toEqual(["a"]);
  });
});

describe("extractBearer", () => {
  it("reads the token case-insensitively", () => {
    expect(extractBearer({ Authorization: "Bearer abc" })).toBe("abc");
    expect(extractBearer({ authorization: "bearer abc" })).toBe("abc");
    expect(extractBearer({ authorization: "Basic abc" })).toBeUndefined();
    expect(extractBearer({})).toBeUndefined();
  });
});

describe("authenticate", () => {
  it("derives sub, email and admin flag", async () => {
    const user = await authenticate(
      { authorization: "Bearer t" },
      verifier({ sub: "u1", email: "a@b.org", email_verified: true, "cognito:groups": ["admin"], "cognito:username": "uname" }),
    );
    expect(user).toMatchObject({ sub: "u1", email: "a@b.org", isAdmin: true, username: "uname" });
  });

  it("is not admin without the group", async () => {
    const user = await authenticate({ authorization: "Bearer t" }, verifier({ sub: "u1", email: "a@b.org", email_verified: true }));
    expect(user.isAdmin).toBe(false);
  });

  it("rejects an unverified email with 403, whatever else the token says", async () => {
    for (const email_verified of [false, undefined, "false"]) {
      await expect(authenticate({ authorization: "Bearer t" }, verifier({ sub: "u1", email: "a@b.org", email_verified }))).rejects.toMatchObject({ status: 403 });
    }
    const user = await authenticate({ authorization: "Bearer t" }, verifier({ sub: "u1", email: "a@b.org", email_verified: "true" }));
    expect(user.sub).toBe("u1");
  });

  it("rejects missing and invalid tokens with 401", async () => {
    await expect(authenticate({}, verifier({ sub: "u" }))).rejects.toMatchObject({ status: 401 });
    const bad = authenticate({ authorization: "Bearer t" }, verifier(new Error("expired")));
    await expect(bad).rejects.toBeInstanceOf(HttpError);
    await expect(bad).rejects.toMatchObject({ status: 401 });
  });
});
