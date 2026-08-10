import "./monster-master-rpg-travel-control.js";
import { gameFrameFetch } from "./gameframe-auth.js";
import { buildExplorationMonsterControlRequest } from "./monster-master-rpg-model.js";

const VIEW_EVENT = "gameframe:monster-master-pixi-view";
const MAX_REQUEST_TIMEOUT_MS = 12_000;
const RECONCILE_ATTEMPTS = 12;
const RECONCILE_DELAY_MS = 500;

const identity = window.gameFrameIdentity;
if (!identity?.playerId) {
  throw new Error("Monster Master RPG monster control requires an authenticated GameFrame identity.");
}

const elements = {
  status: document.querySelector("#mm-rpg-action-status"),
  error: document.querySelector("#mm-rpg-error"),
  coordination: document.querySelector("#mm-rpg-coordination"),
  refresh: document.querySelector("#mm-rpg-refresh"),
};

let controls = [];
let pendingRequest = null;
let pendingTarget = null;
let submitting = false;
let button = null;
let chooser = null;

function worldState() {
  const world = window.gameFrameMonsterRpgWorld;
  return {
    payload: world?.getPayload?.() ?? null,
    position: world?.getPlayerPosition?.() ?? null,
  };
}

function availableControls() {
  const { payload } = worldState();
  const monsters = Array.isArray(payload?.projection?.viewer?.monsters)
    ? payload.projection.viewer.monsters
    : [];
  return monsters
    .filter((monster) =>
      monster
      && typeof monster.controlTargetId === "string"
      && typeof monster.displayLabel === "string"
      && (monster.deploymentState === "recalled" || monster.deploymentState === "deployed")
    )
    .map((monster) => ({
      controlTargetId: monster.controlTargetId,
      displayLabel: monster.displayLabel,
      operation: monster.deploymentState === "recalled" ? "deploy" : "recall",
      deployedSceneId: monster.deployedSceneId ?? null,
    }))
    .filter((control) => {
      if (control.operation !== "recall") return true;
      return control.deployedSceneId === payload?.projection?.scene?.sceneId;
    })
    .sort((left, right) => {
      const byLabel = left.displayLabel.localeCompare(right.displayLabel);
      return byLabel || left.controlTargetId.localeCompare(right.controlTargetId);
    });
}

function actionLabel(control) {
  return `${control.operation === "deploy" ? "Deploy" : "Recall"} ${control.displayLabel}`;
}

function ensureControls() {
  const stage = document.querySelector("#mm-rpg-world .mm-rpg-world-stage");
  if (!stage) return null;
  if (!button?.isConnected) {
    button = document.createElement("button");
    button.type = "button";
    button.id = "mm-rpg-monster-control";
    button.className = "mm-rpg-world-interact mm-rpg-world-monster-control";
    button.hidden = true;
    button.addEventListener("click", () => {
      if (submitting || controls.length === 0) return;
      if (pendingRequest && pendingTarget) {
        void submitControl(pendingTarget);
        return;
      }
      if (controls.length === 1) {
        void submitControl(controls[0]);
        return;
      }
      renderChooser(!chooser || chooser.hidden);
    });
    stage.append(button);
  }
  if (!chooser?.isConnected) {
    chooser = document.createElement("div");
    chooser.id = "mm-rpg-monster-control-chooser";
    chooser.className = "mm-rpg-world-interact-chooser mm-rpg-world-monster-control-chooser";
    chooser.setAttribute("role", "group");
    chooser.setAttribute("aria-label", "Choose a roster monster to deploy or recall");
    chooser.hidden = true;
    stage.append(chooser);
  }
  return button;
}

function renderChooser(open = false) {
  ensureControls();
  if (!chooser) return;
  chooser.replaceChildren();
  if (!open || controls.length <= 1 || pendingRequest || submitting) {
    chooser.hidden = true;
    return;
  }
  const heading = document.createElement("span");
  heading.className = "mm-rpg-world-interact-chooser-label";
  heading.textContent = "Roster control";
  chooser.append(heading);
  for (const control of controls) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "mm-rpg-world-interact-choice";
    option.dataset.controlTargetId = control.controlTargetId;
    option.textContent = actionLabel(control);
    option.addEventListener("click", () => {
      chooser.hidden = true;
      void submitControl(control);
    });
    chooser.append(option);
  }
  chooser.hidden = false;
}

function synchronize() {
  controls = availableControls();
  const control = ensureControls();
  if (!control) return;

  if (pendingRequest && pendingTarget) {
    control.hidden = false;
    control.disabled = submitting;
    control.textContent = `Retry ${actionLabel(pendingTarget)}`;
    control.setAttribute("aria-label", `Retry ${actionLabel(pendingTarget)}`);
    if (chooser) chooser.hidden = true;
    return;
  }

  control.hidden = controls.length === 0;
  control.disabled = submitting;
  control.textContent = controls.length === 1
    ? actionLabel(controls[0])
    : controls.length > 1
      ? `Roster · ${controls.length} available`
      : "Roster";
  control.setAttribute(
    "aria-label",
    controls.length === 1
      ? actionLabel(controls[0])
      : controls.length > 1
        ? `Choose among ${controls.length} roster monster controls`
        : "Roster monster control",
  );
  if (chooser && !chooser.hidden) renderChooser(true);
}

function currentCoordinationRevision() {
  const value = Number(elements.coordination?.textContent ?? "");
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Campaign coordination state is unavailable. Refresh the campaign and try again.");
  }
  return value;
}

function sameControl(left, right) {
  return Boolean(
    left
    && right
    && left.controlTargetId === right.controlTargetId
    && left.operation === right.operation
  );
}

function prepareRequest(target) {
  if (pendingRequest) {
    if (!sameControl(target, pendingTarget)) {
      throw new Error("An earlier roster command has unconfirmed delivery. Retry it before issuing another.");
    }
    return pendingRequest;
  }
  const current = controls.find((candidate) => sameControl(candidate, target));
  if (!current) throw new Error("The selected roster control is no longer available.");
  const { payload, position } = worldState();
  if (!payload?.projection || !payload?.materialization || !position) {
    throw new Error("The physical campaign scene is not ready for roster control.");
  }
  pendingTarget = { ...target };
  pendingRequest = {
    ...buildExplorationMonsterControlRequest({
      campaignId: payload.projection.campaignId,
      commandId: `command:${crypto.randomUUID()}`,
      expectedGameframeCoordinationRevision: currentCoordinationRevision(),
      sceneId: payload.projection.scene.sceneId,
      materializationRef: payload.materialization.materializationRef,
      expectedPositionRevision: position.positionRevision,
      operation: target.operation,
      controlTargetId: target.controlTargetId,
    }),
    issuedAt: new Date().toISOString(),
  };
  synchronize();
  return pendingRequest;
}

function showError(message) {
  if (!elements.error) return;
  elements.error.textContent = message || "";
  elements.error.hidden = !message;
}

async function requestControl(request) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), MAX_REQUEST_TIMEOUT_MS);
  try {
    const response = await gameFrameFetch(
      `/api/rpg/campaigns/${encodeURIComponent(request.campaignId)}/exploration/control`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      },
      identity,
    );
    const text = await response.text();
    const value = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(value?.message || `Monster control failed (${response.status}).`);
      error.status = response.status;
      error.code = value?.error || "request_failed";
      throw error;
    }
    return value;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("GameFrame did not confirm roster control before the request timed out.");
      timeoutError.code = "request_timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function reconcile(target) {
  const desiredState = target.operation === "deploy" ? "deployed" : "recalled";
  for (let attempt = 0; attempt < RECONCILE_ATTEMPTS; attempt += 1) {
    await window.gameFrameMonsterRpgWorld?.attachCurrentCampaign?.({ quiet: true })
      ?.catch?.(() => undefined);
    const current = availableControls();
    const { payload } = worldState();
    const monster = payload?.projection?.viewer?.monsters?.find?.(
      (candidate) => candidate.controlTargetId === target.controlTargetId,
    );
    if (monster?.deploymentState === desiredState) return true;
    await new Promise((resolve) => window.setTimeout(resolve, RECONCILE_DELAY_MS));
    controls = current;
  }
  return false;
}

async function submitControl(target) {
  if (submitting) return;
  let request;
  try {
    request = prepareRequest(target);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Roster control could not be prepared.");
    return;
  }

  submitting = true;
  showError("");
  if (button) button.disabled = true;
  if (chooser) chooser.hidden = true;
  if (elements.status) elements.status.textContent = `${actionLabel(target)}…`;

  try {
    await requestControl(request);
    const completedTarget = { ...pendingTarget };
    pendingRequest = null;
    pendingTarget = null;
    if (elements.status) {
      elements.status.textContent = `${actionLabel(completedTarget)} accepted. Synchronizing the physical scene…`;
    }
    elements.refresh?.click();
    const reconciled = await reconcile(completedTarget);
    if (elements.status) {
      elements.status.textContent = reconciled
        ? `${completedTarget.displayLabel} is ${completedTarget.operation === "deploy" ? "deployed in the current scene" : "recalled"}.`
        : `${actionLabel(completedTarget)} was accepted. The scene will update when Runtime finishes the command.`;
    }
  } catch (error) {
    const stale = error?.status === 409 && [
      "coordination-revision-conflict",
      "position-revision-conflict",
      "stale-materialization",
      "control-target-unavailable",
      "control-state-conflict",
    ].includes(error?.code);
    if (stale) {
      pendingRequest = null;
      pendingTarget = null;
      await window.gameFrameMonsterRpgWorld?.attachCurrentCampaign?.({ quiet: true })
        ?.catch?.(() => undefined);
      elements.refresh?.click();
      if (elements.status) {
        elements.status.textContent = "Roster or exploration state changed. Refreshed the current scene.";
      }
    } else if (elements.status) {
      elements.status.textContent = "Roster-control delivery was not confirmed. Retry sends the exact same command.";
    }
    showError(error?.message || "Roster control could not be delivered.");
  } finally {
    submitting = false;
    synchronize();
  }
}

window.gameFrameMonsterRpgControl = Object.freeze({
  getControls: () => controls.map((control) => ({ ...control })),
  getPendingRequest: () => pendingRequest ? structuredClone(pendingRequest) : null,
  refresh: synchronize,
});

window.addEventListener(VIEW_EVENT, () => queueMicrotask(synchronize));
window.addEventListener("gameframe:before-home", () => {
  controls = [];
  pendingRequest = null;
  pendingTarget = null;
  if (button) button.hidden = true;
  if (chooser) chooser.hidden = true;
});
queueMicrotask(synchronize);
