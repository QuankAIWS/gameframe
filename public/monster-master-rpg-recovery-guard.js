const RECOVERY_TIMEOUT_MS = 2_500;
const INSTALL_INTERVAL_MS = 50;

function timeoutPromise(label) {
  return new Promise((_, reject) => {
    window.setTimeout(() => {
      const error = new Error(`${label} did not complete before the recovery timeout.`);
      error.code = "recovery_timeout";
      reject(error);
    }, RECOVERY_TIMEOUT_MS);
  });
}

function installBoundedWorldRecovery() {
  const world = window.gameFrameMonsterRpgWorld;
  if (!world?.attachCurrentCampaign || world.__boundedRecovery === true) return false;
  const originalAttach = world.attachCurrentCampaign.bind(world);
  const wrapped = Object.freeze({
    ...world,
    __boundedRecovery: true,
    attachCurrentCampaign: (...args) => Promise.race([
      Promise.resolve().then(() => originalAttach(...args)),
      timeoutPromise("Exploration refresh"),
    ]),
  });
  window.gameFrameMonsterRpgWorld = wrapped;
  return true;
}

if (!installBoundedWorldRecovery()) {
  const installer = window.setInterval(() => {
    if (!installBoundedWorldRecovery()) return;
    window.clearInterval(installer);
  }, INSTALL_INTERVAL_MS);
  window.setTimeout(() => window.clearInterval(installer), 30_000);
}
