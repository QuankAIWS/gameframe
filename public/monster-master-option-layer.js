const options = document.querySelector("#monster-master-options");
const commandDeck = document.querySelector(".monster-master-command-deck");
const stylesheetUrl = "/monster-master-option-layer.css";

let positionFrame = 0;
let pendingNodes = null;
let pendingContext = "";
let pendingFlush = false;

function ensureStylesheet() {
  if (document.querySelector(`link[href="${stylesheetUrl}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = stylesheetUrl;
  document.head.append(link);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function renderContext() {
  const pressed = [...document.querySelectorAll(
    ".monster-master-action-bar button[aria-pressed=\"true\"]",
  )].map((button) => button.id).join(",");
  return [
    new URLSearchParams(window.location.search).get("match") ?? "",
    document.querySelector("#monster-master-revision")?.textContent ?? "",
    document.querySelector("#monster-master-phase")?.textContent ?? "",
    pressed,
  ].join("|");
}

function semanticMarkup(node) {
  if (!(node instanceof Element)) return null;
  const clone = node.cloneNode(true);
  if (clone instanceof Element) clone.removeAttribute("data-preview");
  return clone.outerHTML;
}

function nodesSignature(nodes) {
  return nodes.map((node) => {
    if (node.nodeType === Node.TEXT_NODE) return `#text:${node.textContent ?? ""}`;
    if (node instanceof Element) return semanticMarkup(node);
    return `${node.nodeName}:${node.textContent ?? ""}`;
  }).join("\n");
}

function synchronizeTransientState(currentNodes, nextNodes) {
  currentNodes.forEach((currentNode, index) => {
    const nextNode = nextNodes[index];
    if (!(currentNode instanceof HTMLElement) || !(nextNode instanceof HTMLElement)) return;
    if (nextNode.dataset.preview === undefined) {
      delete currentNode.dataset.preview;
    } else {
      currentNode.dataset.preview = nextNode.dataset.preview;
    }
  });
}

function positionOptionLayer() {
  positionFrame = 0;
  if (!options || !commandDeck || !document.body.classList.contains("monster-master-match-active")) return;

  const rect = commandDeck.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const gutter = window.innerWidth <= 640 ? 8 : 12;
  const availableWidth = Math.max(1, window.innerWidth - gutter * 2);
  const width = Math.min(Math.max(rect.width, 240), availableWidth);
  const left = clamp(rect.left, gutter, Math.max(gutter, window.innerWidth - gutter - width));
  const bottom = Math.max(gutter, window.innerHeight - Math.min(rect.bottom, window.innerHeight - gutter));

  options.style.setProperty("--monster-option-layer-left", `${Math.round(left)}px`);
  options.style.setProperty("--monster-option-layer-width", `${Math.round(width)}px`);
  options.style.setProperty("--monster-option-layer-bottom", `${Math.round(bottom)}px`);
}

function scheduleOptionLayerPosition() {
  if (positionFrame) return;
  positionFrame = requestAnimationFrame(positionOptionLayer);
}

function installStableOptionReconciliation() {
  if (!options || options.dataset.stableOptionReconciliation === "true") return;

  const nativeReplaceChildren = options.replaceChildren.bind(options);
  const nativeAppend = options.append.bind(options);

  function flushPendingOptions() {
    pendingFlush = false;
    if (pendingNodes === null) return;

    const nextNodes = pendingNodes;
    const nextContext = pendingContext;
    pendingNodes = null;
    pendingContext = "";

    const currentNodes = [...options.childNodes];
    const sameContext = options.dataset.optionRenderContext === nextContext;
    const sameMarkup = nodesSignature(currentNodes) === nodesSignature(nextNodes);
    if (!sameContext || !sameMarkup) {
      nativeReplaceChildren(...nextNodes);
      options.dataset.optionRenderContext = nextContext;
    } else {
      synchronizeTransientState(currentNodes, nextNodes);
    }
    scheduleOptionLayerPosition();
  }

  function schedulePendingFlush() {
    if (pendingFlush) return;
    pendingFlush = true;
    queueMicrotask(flushPendingOptions);
  }

  Object.defineProperty(options, "replaceChildren", {
    configurable: true,
    value: (...nodes) => {
      flushPendingOptions();
      if (nodes.length > 0) {
        nativeReplaceChildren(...nodes);
        options.dataset.optionRenderContext = renderContext();
        scheduleOptionLayerPosition();
        return;
      }
      pendingNodes = [];
      pendingContext = renderContext();
      schedulePendingFlush();
    },
  });

  Object.defineProperty(options, "append", {
    configurable: true,
    value: (...nodes) => {
      if (pendingNodes !== null) {
        pendingNodes.push(...nodes);
        schedulePendingFlush();
        return;
      }
      nativeAppend(...nodes);
      scheduleOptionLayerPosition();
    },
  });

  options.dataset.stableOptionReconciliation = "true";
}

function installOptionLayer() {
  if (!options || !commandDeck) return;
  ensureStylesheet();
  installStableOptionReconciliation();

  options.dataset.optionLayer = "true";
  options.setAttribute("aria-label", "Legal Monster Master targets and destinations");
  document.body.append(options);

  new MutationObserver(scheduleOptionLayerPosition).observe(options, {
    childList: true,
    subtree: true,
  });

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(scheduleOptionLayerPosition).observe(commandDeck);
  }

  window.addEventListener("resize", scheduleOptionLayerPosition, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleOptionLayerPosition, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleOptionLayerPosition, { passive: true });
  scheduleOptionLayerPosition();
}

installOptionLayer();

window.gameFrameMonsterOptionLayer = Object.freeze({
  position: scheduleOptionLayerPosition,
  get element() {
    return options;
  },
});
