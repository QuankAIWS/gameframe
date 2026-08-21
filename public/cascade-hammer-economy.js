export const HAMMER_MAX = 6;
export const HAMMER_STAR_STEP = 10;

export function resolveStarHammerReward({ hammers, previousStars, nextStars }) {
  const currentHammers = Math.max(0, Math.min(HAMMER_MAX, Math.floor(Number(hammers) || 0)));
  const previous = Math.max(0, Math.floor(Number(previousStars) || 0));
  const next = Math.max(previous, Math.floor(Number(nextStars) || 0));
  const thresholdCrossings = Math.max(
    0,
    Math.floor(next / HAMMER_STAR_STEP) - Math.floor(previous / HAMMER_STAR_STEP),
  );

  // One result can improve at most three best stars, so a normal completion can
  // cross at most one ten-star boundary. Keep that invariant explicit: Cascade
  // must never surface a +2/+3 hammer result from one round, even if malformed
  // or migrated star data creates an unexpectedly large total jump.
  const earned = Math.min(1, thresholdCrossings);
  const capacity = Math.max(0, HAMMER_MAX - currentHammers);
  const granted = Math.min(earned, capacity);

  return {
    hammers: currentHammers + granted,
    earned,
    granted,
    discarded: earned - granted,
  };
}
