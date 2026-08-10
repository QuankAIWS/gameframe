// Compatibility entrypoint retained for the existing authenticated RPG launcher.
// The current modules separate private Ask-GM presentation from in-world Talk,
// and Talk owns a dedicated conversation panel rather than the generic action box.
await import("./monster-master-rpg-private-markers.js");
await import("./monster-master-rpg-talk-v2.js");
