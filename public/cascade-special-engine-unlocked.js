export * from "./cascade-special-engine.js?base=1";

import {
  CASCADE_LEVELS as baseCascadeLevels,
  applySpecialHammer as baseApplySpecialHammer,
  applySpecialSwap as baseApplySpecialSwap,
  resolveSpecialCascades as baseResolveSpecialCascades,
} from "./cascade-special-engine.js?base=1";

const FULL_SPECIAL_RULES = Object.freeze({
  stripe: true,
  bomb: true,
  color: true,
});

const UNIVERSAL_SPECIAL_MECHANICS = Object.freeze([
  "power-match",
  "cross-blast",
  "color-sweep",
]);

export const CASCADE_LEVELS = Object.freeze(baseCascadeLevels.map((level) => Object.freeze({
  ...level,
  mechanics: Object.freeze([
    ...UNIVERSAL_SPECIAL_MECHANICS,
    ...level.mechanics.filter((mechanic) => !UNIVERSAL_SPECIAL_MECHANICS.includes(mechanic)),
  ]),
})));

function unlockedOptions(options) {
  const supplied = options && typeof options === "object" ? options : {};
  return {
    ...supplied,
    rules: {
      ...FULL_SPECIAL_RULES,
      fish: supplied.rules?.fish === true,
    },
  };
}

export function applySpecialSwap(board, specials, from, to, rng, options = {}) {
  return baseApplySpecialSwap(board, specials, from, to, rng, unlockedOptions(options));
}

export function applySpecialHammer(board, specials, index, rng, options = {}) {
  return baseApplySpecialHammer(board, specials, index, rng, unlockedOptions(options));
}

export function resolveSpecialCascades(board, specials, rng, options = {}) {
  return baseResolveSpecialCascades(board, specials, rng, unlockedOptions(options));
}

export { FULL_SPECIAL_RULES, UNIVERSAL_SPECIAL_MECHANICS };
