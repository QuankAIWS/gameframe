import { expect, test } from "@playwright/test";

test("Matches presents the board-game 1v1 lobby before match activity", async ({ page }) => {
  await page.goto("/matches.html?player=matches-lobby-ui");

  await expect(page.getByRole("heading", { name: "Matches" })).toBeVisible();
  await expect(page.getByText("Your 1v1 lobby.")).toBeVisible();

  const start = page.getByRole("region", { name: "Start a match" });
  await expect(start).toBeVisible();
  await expect(start.getByRole("link", { name: "Tic-Tac-Toe", exact: true }).first()).toHaveAttribute(
    "href",
    "/?game=tic-tac-toe&menu=1",
  );
  await expect(start.getByRole("link", { name: "Checkers", exact: true }).first()).toHaveAttribute(
    "href",
    "/?game=american-checkers&menu=1",
  );
  await expect(start.getByRole("link", { name: "Othello", exact: true }).first()).toHaveAttribute(
    "href",
    "/othello.html",
  );

  await expect(start.getByRole("link", { name: "All", exact: true })).toHaveAttribute("href", "/matches.html");
  await expect(start.getByRole("link", { name: "Checkers", exact: true }).last()).toHaveAttribute(
    "href",
    "/matches.html?game=american-checkers",
  );

  const sectionOrder = await page.locator(".platform-grid > .platform-section h2").allTextContents();
  expect(sectionOrder).toEqual(["Start a match", "Challenges", "Your turn", "Waiting", "Completed"]);
});
