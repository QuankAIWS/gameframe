// Compatibility entrypoint retained for the existing authenticated RPG launcher.
// The current modules separate private Ask-GM presentation from in-world Talk,
// and bounded nearby world controls are loaded beside those interaction surfaces.
await import("./monster-master-rpg-private-markers.js");
await import("./monster-master-rpg-talk-v2.js");
await import("./monster-master-rpg-object-control.js");
await import("./monster-master-rpg-shell-bridge.js");
