import { tryGameFrameIdentity } from "./gameframe-auth.js";
import "./gameframe-nav.js";

const parameters = new URLSearchParams(window.location.search);
const identity = await tryGameFrameIdentity({
  preferredDevelopmentPlayerId: parameters.get("player"),
});

if (identity) window.gameFrameIdentity = identity;
