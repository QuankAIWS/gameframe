import assert from "node:assert/strict";
import test from "node:test";
import { errorResponse } from "./http-utils.ts";

test("errorResponse preserves explicit HTTP status codes", async () => {
  const response = errorResponse(Object.assign(new Error("Approval required."), {
    code: "family_approval_required",
    status: 403,
  }));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "family_approval_required",
    message: "Approval required.",
  });
});

test("errorResponse ignores invalid explicit status codes and keeps code mappings", async () => {
  const response = errorResponse(Object.assign(new Error("Authentication required."), {
    code: "authentication_required",
    status: 200,
  }));
  assert.equal(response.status, 401);
});
