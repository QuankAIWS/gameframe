export const RPG_GAMEFRAME_RUNTIME_INTEGRATION_CONTRACT = "gameframe-rpg-runtime" as const;

/**
 * Deployment compatibility generation for the GameFrame <-> RPG GM Runtime boundary.
 *
 * This is deliberately independent from:
 * - the GameFrame repository SHA, which remains the immutable release identity;
 * - Monster Master staging campaign epochs such as monster-master-staging-v6;
 * - individual protocolVersion fields that version one transport shape.
 *
 * Bump this only when a GameFrame change requires a coordinated Runtime change.
 * Unrelated games, UI polish, assets, and backward-compatible RPG changes do not
 * require a bump.
 */
export const RPG_GAMEFRAME_RUNTIME_INTEGRATION_GENERATION = 1 as const;
