export const REFERENCE_CAMPAIGN_ID = "campaign-monster-master-reference";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const COMMAND_ID_PATTERN = /^command:[A-Za-z0-9_-]{8,160}$/;
const MAX_CHOICE_OPTIONS = 16;

export function normalizeCampaignId(value) {
  const campaignId = String(value ?? "").trim();
  if (!IDENTIFIER_PATTERN.test(campaignId)) {
    throw new TypeError("Campaign codes may contain letters, numbers, periods, underscores, colons, and hyphens.");
  }
  return campaignId;
}

export function buildAttachRequest(campaignIdValue) {
  const campaignId = normalizeCampaignId(campaignIdValue);
  return { protocolVersion: 2, campaignId };
}

export function buildActionCommand({
  campaignId: campaignIdValue,
  commandId,
  issuedAt,
  expectedGameframeCoordinationRevision,
  text,
}) {
  const campaignId = normalizeCampaignId(campaignIdValue);
  const action = String(text ?? "").trim();
  if (!action || action.length > 2_000) {
    throw new TypeError("Player actions must contain 1 through 2,000 characters.");
  }
  validateCommandIdentity(commandId, issuedAt, expectedGameframeCoordinationRevision);
  return {
    protocolVersion: 2,
    campaignId,
    commandId,
    issuedAt,
    command: {
      kind: "campaign.submit_action",
      expectedGameframeCoordinationRevision,
      visibility: "public",
      text: action,
    },
  };
}

export function buildExplorationTalkRequest({
  campaignId: campaignIdValue,
  commandId,
  expectedGameframeCoordinationRevision,
  sceneId,
  materializationRef,
  expectedPositionRevision,
  interactionTargetId,
  text,
}) {
  const campaignId = normalizeCampaignId(campaignIdValue);
  validateCommandIdAndRevision(commandId, expectedGameframeCoordinationRevision);
  const action = String(text ?? "").trim();
  if (!action || action.length > 2_000) {
    throw new TypeError("Talk must contain 1 through 2,000 characters.");
  }
  if (!materializationRef || typeof materializationRef !== "object" || Array.isArray(materializationRef)) {
    throw new TypeError("Talk requires the current materialization reference.");
  }
  return {
    type: "exploration_interact",
    protocolVersion: 1,
    campaignId,
    sceneId: boundedIdentifier(sceneId, "sceneId"),
    materializationRef: {
      materializationId: boundedIdentifier(
        materializationRef.materializationId,
        "materializationId",
      ),
      version: boundedIdentifier(materializationRef.version, "materializationVersion"),
      hash: boundedIdentifier(materializationRef.hash, "materializationHash"),
    },
    expectedPositionRevision: nonNegativeInteger(
      expectedPositionRevision,
      "expectedPositionRevision",
    ),
    expectedGameframeCoordinationRevision,
    commandId,
    interaction: "talk",
    interactionTargetId: boundedIdentifier(interactionTargetId, "interactionTargetId"),
    text: action,
  };
}

export function buildExplorationMonsterControlRequest({
  campaignId: campaignIdValue,
  commandId,
  expectedGameframeCoordinationRevision,
  sceneId,
  materializationRef,
  expectedPositionRevision,
  operation,
  controlTargetId,
}) {
  const campaignId = normalizeCampaignId(campaignIdValue);
  validateCommandIdAndRevision(commandId, expectedGameframeCoordinationRevision);
  if (operation !== "deploy" && operation !== "recall") {
    throw new TypeError("Monster control operation must be deploy or recall.");
  }
  if (!materializationRef || typeof materializationRef !== "object" || Array.isArray(materializationRef)) {
    throw new TypeError("Monster control requires the current materialization reference.");
  }
  return {
    type: "exploration_monster_control",
    protocolVersion: 1,
    campaignId,
    sceneId: boundedIdentifier(sceneId, "sceneId"),
    materializationRef: {
      materializationId: boundedIdentifier(
        materializationRef.materializationId,
        "materializationId",
      ),
      version: boundedIdentifier(materializationRef.version, "materializationVersion"),
      hash: boundedIdentifier(materializationRef.hash, "materializationHash"),
    },
    expectedPositionRevision: nonNegativeInteger(
      expectedPositionRevision,
      "expectedPositionRevision",
    ),
    expectedGameframeCoordinationRevision,
    commandId,
    operation,
    controlTargetId: boundedIdentifier(controlTargetId, "controlTargetId"),
  };
}

export function buildChoiceCommand({
  campaignId: campaignIdValue,
  commandId,
  issuedAt,
  expectedGameframeCoordinationRevision,
  choiceId,
  optionId,
}) {
  const campaignId = normalizeCampaignId(campaignIdValue);
  validateCommandIdentity(commandId, issuedAt, expectedGameframeCoordinationRevision);
  return {
    protocolVersion: 2,
    campaignId,
    commandId,
    issuedAt,
    command: {
      kind: "campaign.submit_choice",
      expectedGameframeCoordinationRevision,
      choiceId: boundedIdentifier(choiceId, "choiceId"),
      optionId: boundedIdentifier(optionId, "optionId"),
    },
  };
}

export function normalizeProjection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("GameFrame returned an invalid campaign projection.");
  }
  const campaignId = normalizeCampaignId(value.campaignId);
  const gameframeCoordinationRevision = nonNegativeInteger(
    value.gameframeCoordinationRevision,
    "gameframeCoordinationRevision",
  );
  const presentationSequence = nonNegativeInteger(value.presentationSequence, "presentationSequence");
  const linkedNarrativeRevision = nonNegativeInteger(
    value.linkedNarrativeRevision,
    "linkedNarrativeRevision",
  );
  const events = Array.isArray(value.events) ? value.events.map(normalizeEvent) : [];
  return {
    ...value,
    campaignId,
    title: readableText(value.title, 200) ?? "Monster Master campaign",
    status: readableText(value.status, 40) ?? "active",
    gameframeCoordinationRevision,
    presentationSequence,
    linkedNarrativeRevision,
    events,
  };
}

export function mergeCampaignEvents(existing, incoming) {
  const merged = new Map();
  for (const event of [...existing, ...incoming]) {
    const normalized = normalizeEvent(event);
    merged.set(normalized.eventId, normalized);
  }
  return [...merged.values()].sort((left, right) => {
    const leftSequence = Number.isInteger(left.presentationSequence) ? left.presentationSequence : null;
    const rightSequence = Number.isInteger(right.presentationSequence) ? right.presentationSequence : null;
    if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }
    const leftTime = Date.parse(left.createdAt ?? "");
    const rightTime = Date.parse(right.createdAt ?? "");
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.eventId.localeCompare(right.eventId);
  });
}

export function isChoicePresentedEvent(eventValue) {
  try {
    return normalizeEvent(eventValue).kind === "choice.presented";
  } catch {
    return false;
  }
}

export function isEncounterPresentedEvent(eventValue) {
  try {
    const event = normalizeEvent(eventValue);
    return event.kind === "scene.presented"
      && optionalRecord(event.payload.mechanic)?.kind === "encounter";
  } catch {
    return false;
  }
}

export function presentCampaignEncounter(eventValue, campaignIdValue) {
  const event = normalizeEvent(eventValue);
  if (event.kind !== "scene.presented") {
    throw new TypeError("Only scene.presented events can contain an encounter handoff.");
  }
  const mechanic = optionalRecord(event.payload.mechanic);
  if (mechanic?.kind !== "encounter") {
    throw new TypeError("The scene does not contain an encounter handoff.");
  }
  const encounterId = boundedIdentifier(mechanic.encounterId, "encounterId");
  const campaignId = normalizeCampaignId(campaignIdValue);
  const state = readableText(mechanic.state, 40) ?? "preparing";
  const reason = readableText(mechanic.reason, 1_000)
    ?? "The situation has moved into a tactical encounter.";
  const objective = readableText(mechanic.objective, 1_000)
    ?? "Resolve the encounter and return to the campaign.";
  const matchId = `rpg:${encounterId}`;
  return {
    encounterId,
    campaignId,
    matchId,
    state,
    reason,
    objective,
    href: `/monster-master.html?match=${encodeURIComponent(matchId)}&campaign=${encodeURIComponent(campaignId)}`,
  };
}

export function presentCampaignChoice(eventValue, playerIdValue, allEventsValue = []) {
  const event = normalizeEvent(eventValue);
  if (event.kind !== "choice.presented") {
    throw new TypeError("Only choice.presented events can become suggested player approaches.");
  }
  const playerId = boundedIdentifier(playerIdValue, "playerId");
  const choiceId = boundedIdentifier(event.payload.choiceId, "choiceId");
  const prompt = readableText(event.payload.prompt, 1_000)
    ?? readableText(event.payload.text, 1_000)
    ?? "What do you do?";
  const allowedPlayerIds = normalizeAllowedPlayers(event.payload.allowedPlayerIds);
  const options = normalizeChoiceOptions(event.payload.options);
  const events = Array.isArray(allEventsValue) ? allEventsValue.map(normalizeEvent) : [];
  const submission = events.toReversed().find((candidate) =>
    candidate.kind === "campaign.choice_submitted"
    && candidate.payload.choiceId === choiceId
  );
  const authorized = allowedPlayerIds === null || allowedPlayerIds.includes(playerId);
  const selectedOptionId = submission && typeof submission.payload.optionId === "string"
    ? submission.payload.optionId
    : null;
  const selectedLabel = submission && typeof submission.payload.label === "string"
    ? submission.payload.label
    : options.find((option) => option.optionId === selectedOptionId)?.label ?? null;
  return {
    eventId: event.eventId,
    choiceId,
    prompt,
    authorized,
    submitted: Boolean(submission),
    selectedOptionId,
    selectedLabel,
    submittedBy: submission && typeof submission.payload.actorId === "string"
      ? submission.payload.actorId
      : null,
    options: options.map((option) => ({
      ...option,
      selected: option.optionId === selectedOptionId,
      disabled: !authorized || Boolean(submission),
    })),
  };
}

export function presentCampaignEvent(eventValue) {
  const event = normalizeEvent(eventValue);
  const payload = event.payload;
  const dialogue = firstDialogue(payload.dialogue);
  const speaker = dialogue?.speakerName
    ?? readableText(payload.speakerName, 120)
    ?? readableText(payload.speaker, 120)
    ?? readableText(payload.actorName, 120);
  const submittedAction = event.kind === "campaign.action_submitted"
    ? readableText(payload.text, 4_000)
    : null;
  const heading = submittedAction
    ? `Submitted: ${summarize(submittedAction, 88)}`
    : speaker
      ?? readableText(payload.title, 160)
      ?? headingForKind(event.kind);
  const narration = readableText(payload.narration, 4_000);
  const body = dialogue
    ? [narration, dialogue.text].filter(Boolean).join("\n\n")
    : narration
      ?? readableText(payload.text, 4_000)
      ?? readableText(payload.dialogue, 4_000)
      ?? readableText(payload.message, 4_000)
      ?? readableText(payload.description, 4_000)
      ?? compactPayload(payload);
  return {
    eventId: event.eventId,
    kind: event.kind,
    heading,
    body,
    createdAt: event.createdAt ?? null,
    tone: dialogue ? "dialogue" : toneForKind(event.kind),
    audience: audienceLabel(event.audience),
  };
}

function validateCommandIdentity(commandId, issuedAt, expectedGameframeCoordinationRevision) {
  validateCommandIdAndRevision(commandId, expectedGameframeCoordinationRevision);
  if (!issuedAt || Number.isNaN(Date.parse(issuedAt))) {
    throw new TypeError("A valid command timestamp is required.");
  }
}

function validateCommandIdAndRevision(commandId, expectedGameframeCoordinationRevision) {
  if (!COMMAND_ID_PATTERN.test(String(commandId ?? ""))) {
    throw new TypeError("A stable command ID is required.");
  }
  if (!Number.isInteger(expectedGameframeCoordinationRevision) || expectedGameframeCoordinationRevision < 0) {
    throw new TypeError("A non-negative GameFrame coordination revision is required.");
  }
}

function boundedIdentifier(value, label) {
  const normalized = String(value ?? "").trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new TypeError(`${label} must be a bounded identifier.`);
  }
  return normalized;
}

function normalizeAllowedPlayers(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 32) {
    throw new TypeError("Choice allowedPlayerIds must be a bounded array.");
  }
  return value.map((playerId) => boundedIdentifier(playerId, "allowedPlayerId"));
}

function normalizeChoiceOptions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CHOICE_OPTIONS) {
    throw new TypeError(`Choices must contain from 1 through ${MAX_CHOICE_OPTIONS} options.`);
  }
  const options = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError("Choice options must be objects.");
    }
    const optionId = boundedIdentifier(entry.optionId, "optionId");
    const label = readableText(entry.label, 240);
    if (!label) throw new TypeError("Choice options require a bounded label.");
    const suggestedAction = readableText(entry.actionText, 2_000)
      ?? readableText(entry.text, 2_000)
      ?? label;
    return { optionId, label, suggestedAction };
  });
  if (new Set(options.map((option) => option.optionId)).size !== options.length) {
    throw new TypeError("Choice option IDs must be unique.");
  }
  return options;
}

function firstDialogue(value) {
  if (!Array.isArray(value) || value.length < 1) return null;
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const speakerName = readableText(candidate.speakerName, 120);
    const text = readableText(candidate.text, 4_000);
    if (speakerName && text) return { speakerName, text };
  }
  return null;
}

function normalizeEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Campaign events must be objects.");
  }
  const eventId = String(value.eventId ?? "").trim();
  const kind = String(value.kind ?? value.type ?? "campaign.event").trim();
  if (!eventId || eventId.length > 240 || !kind || kind.length > 160) {
    throw new TypeError("Campaign events require bounded event and kind identifiers.");
  }
  const payload = value.payload && typeof value.payload === "object" && !Array.isArray(value.payload)
    ? value.payload
    : {};
  return { ...value, eventId, kind, payload };
}

function optionalRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function nonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`Campaign projection ${label} must be a non-negative integer.`);
  }
  return value;
}

function readableText(value, maximumLength) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximumLength ? text : null;
}

function summarize(value, maximumLength) {
  if (value.length <= maximumLength) return value;
  return `${value.slice(0, Math.max(1, maximumLength - 1)).trimEnd()}…`;
}

function compactPayload(payload) {
  const entries = Object.entries(payload)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .slice(0, 6)
    .map(([key, value]) => `${humanize(key)}: ${String(value)}`);
  return entries.join(" · ") || "Campaign state updated.";
}

function headingForKind(kind) {
  const endings = kind.split(".");
  return humanize(endings[endings.length - 1] || "Campaign update");
}

function humanize(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toneForKind(kind) {
  if (/dialogue|speaker/.test(kind)) return "dialogue";
  if (/choice|input|request/.test(kind)) return "prompt";
  if (/check|consequence|condition|warning/.test(kind)) return "consequence";
  if (/action|submitted/.test(kind)) return "action";
  return "narrative";
}

function audienceLabel(audience) {
  if (!audience || typeof audience !== "object") return "Campaign";
  if (audience.kind === "player") return "Private";
  if (audience.kind === "party") return "Party";
  return "Campaign";
}
