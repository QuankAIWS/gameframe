export const CARD_KIT_SUITS = Object.freeze(["spades", "hearts", "diamonds", "clubs"]);

const RANK_LABELS = Object.freeze({ 1: "A", 11: "J", 12: "Q", 13: "K" });
const SUIT_MARKS = Object.freeze({ spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" });
const SVG_NS = "http://www.w3.org/2000/svg";

export function cardRankLabel(rank) {
  return RANK_LABELS[rank] || String(rank);
}

export function cardSuitMark(suit) {
  return SUIT_MARKS[suit] || "";
}

export function isRedCardSuit(suit) {
  return suit === "hearts" || suit === "diamonds";
}

export function rankSizeForReveal(reveal, {
  minimum = 22,
  maximum = 42,
  verticalSafety = 4,
} = {}) {
  const room = Math.floor(Number(reveal) - verticalSafety);
  return Math.max(minimum, Math.min(maximum, room));
}

export function fitCardStack({
  cards,
  availableHeight,
  cardHeight,
  topStart = 3,
  bottomPad = 8,
  desiredFaceUp = 36,
  minimumFaceUp = 24,
  desiredFaceDown = 11,
  minimumFaceDown = 5,
} = {}) {
  const stack = Array.isArray(cards) ? cards : [];
  const gaps = stack.slice(0, -1);
  const faceUpCount = gaps.filter((card) => card?.faceUp).length;
  const faceDownCount = gaps.length - faceUpCount;
  const roomForGaps = Math.max(
    0,
    Number(availableHeight) - Number(topStart) - Number(bottomPad) - Number(cardHeight),
  );

  let faceUp = Number(desiredFaceUp);
  let faceDown = Number(desiredFaceDown);
  let excess = (faceUpCount * faceUp) + (faceDownCount * faceDown) - roomForGaps;

  if (excess > 0 && faceDownCount > 0) {
    const reducible = Math.max(0, faceDown - minimumFaceDown) * faceDownCount;
    const reduction = Math.min(excess, reducible);
    faceDown -= reduction / faceDownCount;
    excess -= reduction;
  }

  if (excess > 0 && faceUpCount > 0) {
    const reducible = Math.max(0, faceUp - minimumFaceUp) * faceUpCount;
    const reduction = Math.min(excess, reducible);
    faceUp -= reduction / faceUpCount;
    excess -= reduction;
  }

  if (excess > 0) {
    const weightedGapCount = (faceUpCount * 2) + faceDownCount;
    const unit = weightedGapCount > 0 ? roomForGaps / weightedGapCount : 0;
    faceUp = unit * 2;
    faceDown = unit;
  }

  return {
    topStart: Number(topStart),
    bottomPad: Number(bottomPad),
    cardHeight: Number(cardHeight),
    faceUp: Math.max(1, faceUp),
    faceDown: Math.max(1, faceDown),
    roomForGaps,
  };
}

function createText(className, value) {
  const node = document.createElementNS(SVG_NS, "text");
  node.setAttribute("class", className);
  node.textContent = value;
  return node;
}

export function createCardFace(card, {
  oneSuit = false,
  rankSize = 36,
  rankAlign = "start",
  topCard = false,
} = {}) {
  const label = cardRankLabel(card.rank);
  const face = document.createElement("span");
  face.className = "card-kit-face";
  if (isRedCardSuit(card.suit)) face.classList.add("is-red");
  if (oneSuit) face.classList.add("is-one-suit");
  if (topCard) face.classList.add("is-top-card");
  face.dataset.rank = label;
  face.dataset.suit = card.suit;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "card-kit-face-svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const wide = label === "10";
  const resolvedRankSize = Math.max(12, Math.round(Number(rankSize)));
  const rank = createText("card-kit-rank", label);
  rank.dataset.wide = wide ? "true" : "false";
  rank.style.fontSize = `${resolvedRankSize}px`;
  rank.setAttribute("y", String(Math.round(resolvedRankSize * 0.76) + 4));
  if (wide) rank.setAttribute("transform", "scale(.78 1)");
  if (rankAlign === "center") {
    rank.setAttribute("x", wide ? "64.1%" : "50%");
    rank.setAttribute("text-anchor", "middle");
  } else {
    rank.setAttribute("x", wide ? "4" : "3");
    rank.setAttribute("text-anchor", "start");
  }

  const suitSize = Math.max(8, Math.min(12, Math.round(Number(rankSize) * 0.26)));
  const suit = createText("card-kit-suit", cardSuitMark(card.suit));
  suit.style.fontSize = `${suitSize}px`;
  suit.setAttribute("x", "96%");
  suit.setAttribute("y", String(Math.max(9, Math.round(suitSize * 0.95))));
  suit.setAttribute("text-anchor", "end");

  svg.append(rank, suit);
  face.append(svg);
  return face;
}

export function renderCardFace(host, card, options) {
  host.querySelector(":scope > .card-kit-face")?.remove();
  const face = createCardFace(card, options);
  host.append(face);
  return face;
}
