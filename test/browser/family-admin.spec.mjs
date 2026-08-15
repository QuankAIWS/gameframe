import { expect, test } from "@playwright/test";

function enrollment(requestId = "request-1", deviceLabel = "Windows browser") {
  return {
    requestId,
    playerId: "discord:123456789012345678",
    displayName: "Family Tester",
    deviceLabel,
    code: "482731",
    createdAt: Date.now(),
    expiresAt: Date.now() + 600_000,
    approvedAt: null,
    approvedBy: null,
    consumedAt: null,
  };
}

async function installFamilyAdminApi(page, state) {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        playerId: "discord:999999999999999999",
        displayName: "Admin",
        source: "discord",
        admin: true,
      }),
    });
  });

  await page.route("**/api/admin/family/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path === "/api/admin/family/enrollments") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requests: state.requests }) });
      return;
    }
    if (request.method() === "GET" && path === "/api/admin/family/devices") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ devices: [] }) });
      return;
    }
    if (request.method() === "POST" && path === "/api/admin/family/enrollments/approve") {
      state.approvalHeader = request.headers()["x-gameframe-family-approval"] ?? null;
      state.approvalBody = request.postDataJSON();
      state.requests = state.requests.filter((item) => item.requestId !== state.approvalBody.requestId);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ approved: true }) });
      return;
    }
    if (request.method() === "POST" && path === "/api/admin/family/enrollments/remove") {
      state.removalBody = request.postDataJSON();
      state.requests = state.requests.filter((item) => item.requestId !== state.removalBody.requestId);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ removed: true }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found" }) });
  });
}

test("family admin approves without a blocking browser prompt", async ({ page }) => {
  const state = { requests: [enrollment()], approvalHeader: null, approvalBody: null };
  let dialogCount = 0;
  page.on("dialog", async (dialog) => {
    dialogCount += 1;
    await dialog.dismiss();
  });
  await installFamilyAdminApi(page, state);

  await page.goto("/family-admin.html");
  await expect(page.locator("[data-approve]")).toHaveCount(1);
  await expect(page.locator("[data-remove]")).toHaveCount(1);

  const approvalSecret = "a".repeat(64);
  await page.locator("#family-approval-credential").fill(approvalSecret);
  await page.locator("[data-approve]").click();

  await expect(page.locator("#family-admin-status")).toContainText("Approved Windows browser");
  await expect(page.locator("#family-enrollment-list")).toContainText("No pending enrollment requests.");
  expect(state.approvalHeader).toBe(approvalSecret);
  expect(state.approvalBody).toEqual({ requestId: "request-1" });
  expect(dialogCount).toBe(0);
});

test("family admin can remove a duplicate pending request without an approval credential", async ({ page }) => {
  const state = { requests: [enrollment("duplicate-request", "Duplicate browser")], removalBody: null };
  let dialogCount = 0;
  page.on("dialog", async (dialog) => {
    dialogCount += 1;
    await dialog.dismiss();
  });
  await installFamilyAdminApi(page, state);

  await page.goto("/family-admin.html");
  await expect(page.locator("[data-remove]")).toHaveCount(1);
  await page.locator("[data-remove]").click();

  await expect(page.locator("#family-admin-status")).toContainText("Removed the pending request for Duplicate browser");
  await expect(page.locator("#family-enrollment-list")).toContainText("No pending enrollment requests.");
  expect(state.removalBody).toEqual({ requestId: "duplicate-request" });
  expect(dialogCount).toBe(0);
});
