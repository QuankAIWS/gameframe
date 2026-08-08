const STAGING_CAMPAIGN_ID = "monster-master-staging";
const PROFILE_KEY_PREFIX = "scribbles-gameframe.monster-master-rpg.profile.v1";
const DEFAULT_OBJECTIVE = "Investigate irregular activity along the Crooked Checkpoint route and complete your supervised field assignment.";

const parameters = new URLSearchParams(window.location.search);
const campaignId = parameters.get("campaign")?.trim() || "";
const stagingCampaign = campaignId === STAGING_CAMPAIGN_ID;

const elements = {
  onboarding: document.querySelector("#mm-rpg-onboarding"),
  progress: document.querySelector("#mm-rpg-onboarding-progress"),
  name: document.querySelector("#mm-rpg-trainer-name"),
  toStarter: document.querySelector("#mm-rpg-onboarding-to-starter"),
  backMaster: document.querySelector("#mm-rpg-onboarding-back-master"),
  toBriefing: document.querySelector("#mm-rpg-onboarding-to-briefing"),
  backStarter: document.querySelector("#mm-rpg-onboarding-back-starter"),
  begin: document.querySelector("#mm-rpg-onboarding-begin"),
  edit: document.querySelector("#mm-rpg-edit-staging-profile"),
  sidebarPlayer: document.querySelector("#mm-rpg-sidebar-player"),
  trainerSummary: document.querySelector("#mm-rpg-trainer-summary"),
  starterName: document.querySelector("#mm-rpg-starter-name"),
  starterSummary: document.querySelector("#mm-rpg-starter-summary"),
  objective: document.querySelector("#mm-rpg-current-objective"),
  situation: document.querySelector("#mm-rpg-current-situation"),
  events: document.querySelector("#mm-rpg-events"),
  action: document.querySelector("#mm-rpg-action"),
  actionStatus: document.querySelector("#mm-rpg-action-status"),
};

const profileKey = `${PROFILE_KEY_PREFIX}:${campaignId || "unbound"}`;
let currentStep = 1;
let profile = stagingCampaign ? readProfile() : null;

function boundedName(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text && text.length <= 40 ? text : null;
}

function readProfile() {
  try {
    const raw = window.localStorage.getItem(profileKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      value?.schemaVersion !== 1
      || value.campaignId !== STAGING_CAMPAIGN_ID
      || !boundedName(value.trainerName)
      || value.archetypeId !== "trainer.archetype.caller"
      || value.backgroundId !== "background.caravan-handler"
      || value.starterSpeciesId !== "monster.emberling-skirmisher"
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function stagingProfile(trainerName) {
  return {
    schemaVersion: 1,
    campaignId: STAGING_CAMPAIGN_ID,
    trainerName,
    archetypeId: "trainer.archetype.caller",
    archetypeLabel: "Caller",
    backgroundId: "background.caravan-handler",
    backgroundLabel: "Caravan Handler",
    starterSpeciesId: "monster.emberling-skirmisher",
    starterSpeciesLabel: "Emberling",
    starterDisplayName: "Cinder",
    starterRole: "skirmisher",
  };
}

function identityDisplayName() {
  return boundedName(window.gameFrameIdentity?.displayName) || "Staging Master";
}

function setStep(step) {
  currentStep = Math.max(1, Math.min(3, Number(step) || 1));
  for (const panel of document.querySelectorAll("[data-onboarding-step]")) {
    panel.hidden = Number(panel.dataset.onboardingStep) !== currentStep;
  }
  if (elements.progress) elements.progress.textContent = `${currentStep} / 3`;
  if (currentStep === 1) elements.name?.focus();
}

function showOnboarding({ edit = false } = {}) {
  if (!stagingCampaign || !elements.onboarding) return;
  document.body.classList.add("mm-rpg-onboarding-active");
  elements.onboarding.hidden = false;
  elements.edit?.setAttribute("hidden", "");
  const existingName = boundedName(profile?.trainerName);
  if (elements.name && (!elements.name.value || edit)) {
    elements.name.value = existingName || identityDisplayName();
  }
  setStep(edit ? 1 : currentStep);
}

function hideOnboarding() {
  document.body.classList.remove("mm-rpg-onboarding-active");
  if (elements.onboarding) elements.onboarding.hidden = true;
  if (stagingCampaign && elements.edit) elements.edit.hidden = false;
}

function renderProfile() {
  if (!profile) return;
  if (elements.sidebarPlayer && elements.sidebarPlayer.textContent !== profile.trainerName) {
    elements.sidebarPlayer.textContent = profile.trainerName;
  }
  const trainerSummary = `${profile.archetypeLabel} · ${profile.backgroundLabel}`;
  if (elements.trainerSummary && elements.trainerSummary.textContent !== trainerSummary) {
    elements.trainerSummary.textContent = trainerSummary;
  }
  if (elements.starterName && elements.starterName.textContent !== profile.starterDisplayName) {
    elements.starterName.textContent = profile.starterDisplayName;
  }
  const starterSummary = `${profile.starterSpeciesLabel} · ${profile.starterRole}`;
  if (elements.starterSummary && elements.starterSummary.textContent !== starterSummary) {
    elements.starterSummary.textContent = starterSummary;
  }
}

function requireTrainerName() {
  const trainerName = boundedName(elements.name?.value);
  if (trainerName) {
    elements.name?.setCustomValidity("");
    return trainerName;
  }
  elements.name?.setCustomValidity("Choose a trainer name from 1 through 40 characters.");
  elements.name?.reportValidity();
  return null;
}

function completeOnboarding() {
  const trainerName = requireTrainerName();
  if (!trainerName) {
    setStep(1);
    return;
  }
  profile = stagingProfile(trainerName);
  window.localStorage.setItem(profileKey, JSON.stringify(profile));
  renderProfile();
  hideOnboarding();
  updateOrientation();
  document.querySelector("#mm-rpg-campaign")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function eventText(item) {
  const paragraph = item?.querySelector("p")?.textContent?.trim() || "";
  return paragraph.length > 190 ? `${paragraph.slice(0, 187)}…` : paragraph;
}

function updateOrientation() {
  if (!elements.objective || !elements.situation) return;
  const encounter = [...document.querySelectorAll(".mm-rpg-encounter-event")].at(-1);
  const encounterObjective = encounter?.querySelector(".mm-rpg-encounter-handoff strong")?.textContent?.trim();
  const arenaBlocked = Boolean(elements.action?.disabled)
    && /Arena Battles|tactical encounter/i.test(elements.actionStatus?.textContent || "");

  elements.objective.textContent = arenaBlocked && encounterObjective
    ? `Resolve the Arena encounter: ${encounterObjective}`
    : DEFAULT_OBJECTIVE;

  const latestEvent = [...document.querySelectorAll("#mm-rpg-events .mm-rpg-event")].at(-1);
  const latestText = eventText(latestEvent);
  elements.situation.textContent = latestText
    || "Review the campaign feed for the immediate situation and choose how your Master responds.";
}

if (stagingCampaign) {
  if (profile) {
    renderProfile();
    hideOnboarding();
  } else {
    showOnboarding();
  }

  window.setTimeout(() => {
    if (!profile && elements.name && !boundedName(elements.name.value)) {
      elements.name.value = identityDisplayName();
    }
    renderProfile();
  }, 400);

  elements.toStarter?.addEventListener("click", () => {
    if (!requireTrainerName()) return;
    setStep(2);
  });
  elements.backMaster?.addEventListener("click", () => setStep(1));
  elements.toBriefing?.addEventListener("click", () => setStep(3));
  elements.backStarter?.addEventListener("click", () => setStep(2));
  elements.begin?.addEventListener("click", completeOnboarding);
  elements.edit?.addEventListener("click", () => showOnboarding({ edit: true }));
}

const orientationObserver = new MutationObserver(updateOrientation);
if (elements.events) orientationObserver.observe(elements.events, { childList: true, subtree: true });
if (elements.action) orientationObserver.observe(elements.action, { attributes: true, attributeFilter: ["disabled"] });
if (elements.actionStatus) orientationObserver.observe(elements.actionStatus, { childList: true, characterData: true, subtree: true });

const profileObserver = new MutationObserver(() => renderProfile());
if (stagingCampaign && elements.sidebarPlayer) {
  profileObserver.observe(elements.sidebarPlayer, { childList: true, characterData: true, subtree: true });
}

updateOrientation();
renderProfile();
