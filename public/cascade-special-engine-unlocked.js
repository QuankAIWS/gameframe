export * from "./cascade-special-engine.js?base=1";

import {
  applySpecialHammer as baseApplySpecialHammer,
  applySpecialSwap as baseApplySpecialSwap,
  resolveSpecialCascades as baseResolveSpecialCascades,
} from "./cascade-special-engine.js?base=1";

const FULL_SPECIAL_RULES = Object.freeze({
  stripe: true,
  bomb: true,
  color: true,
});

function unlockedOptions(options) {
  return {
    ...(options && typeof options === "object" ? options : {}),
    rules: FULL_SPECIAL_RULES,
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

export { FULL_SPECIAL_RULES };
