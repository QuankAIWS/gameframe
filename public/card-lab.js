import {
  fitCardStack,
  rankSizeForReveal,
  renderCardFace,
} from "./card-kit.js";

const rankGallery = document.querySelector("#rank-gallery");
const desktopStack = document.querySelector("#desktop-stack");
const phoneTableau = document.querySelector("#phone-tableau");

function card(rank, suit = "spades", faceUp = true) {
  return { id: `lab-${suit}-${rank}-${crypto.randomUUID?.() || Math.random()}`, rank, suit, faceUp };
}

function makeCard(cardData, {
  rankSize = 38,
  rankAlign = "start",
  topCard = false,
} = {}) {
  const node = document.createElement("div");
  node.className = "card-lab-card card-kit-card";
  renderCardFace(node, cardData, {
    oneSuit: true,
    rankSize,
    rankAlign,
    topCard,
  });
  return node;
}

for (let rank = 1; rank <= 13; rank += 1) {
  rankGallery.append(makeCard(card(rank), { rankSize: 42, topCard: true }));
}

const desktopCards = [7, 10, 1, 2, 12, 3, 11, 7, 10, 10, 2, 10, 13, 12, 4, 5, 12, 1]
  .map((rank) => card(rank));
const desktopLayout = fitCardStack({
  cards: desktopCards,
  availableHeight: 510,
  cardHeight: 132,
  topStart: 5,
  bottomPad: 10,
  desiredFaceUp: 38,
  minimumFaceUp: 25,
  desiredFaceDown: 11,
  minimumFaceDown: 6,
});
let desktopTop = desktopLayout.topStart;
desktopCards.forEach((entry, index) => {
  const last = index === desktopCards.length - 1;
  const rankSize = last ? 42 : rankSizeForReveal(desktopLayout.faceUp, { minimum: 22, maximum: 38, verticalSafety: 5 });
  const node = makeCard(entry, { rankSize, topCard: last });
  node.style.top = `${desktopTop}px`;
  node.style.zIndex = String(index + 1);
  desktopStack.append(node);
  if (!last) desktopTop += desktopLayout.faceUp;
});

const columnRanks = [
  [13, 12, 11, 10, 9],
  [9, 8, 7],
  [3, 2, 1, 13],
  [10, 9, 8, 7],
  [5, 4, 3],
  [12, 11, 10],
  [7, 6, 5, 4],
  [2, 1, 13],
  [8, 7, 6],
  [4, 3, 2, 1],
];

for (const ranks of columnRanks) {
  const column = document.createElement("div");
  column.className = "card-lab-phone-column";
  const cards = ranks.map((rank) => card(rank));
  const layout = fitCardStack({
    cards,
    availableHeight: 425,
    cardHeight: 80,
    topStart: 4,
    bottomPad: 8,
    desiredFaceUp: 30,
    minimumFaceUp: 21,
    desiredFaceDown: 8,
    minimumFaceDown: 4,
  });
  let top = layout.topStart;
  cards.forEach((entry, index) => {
    const last = index === cards.length - 1;
    const rankSize = last ? 30 : rankSizeForReveal(layout.faceUp, { minimum: 21, maximum: 28, verticalSafety: 4 });
    const node = makeCard(entry, {
      rankSize,
      rankAlign: "center",
      topCard: last,
    });
    node.style.top = `${top}px`;
    node.style.zIndex = String(index + 1);
    column.append(node);
    if (!last) top += layout.faceUp;
  });
  phoneTableau.append(column);
}
