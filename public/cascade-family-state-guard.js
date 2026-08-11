(() => {
  const STATE_KEY = "scribbles-gameframe.cascade-state:v1";
  const ACTIVE_RUN_KEY = "scribbles-gameframe.cascade-active-run:v1";
  const LIFE_QUEUE_KEY = "scribbles-gameframe.cascade-life-queue:v1";
  const BLITZ_RETURN_KEY = "scribbles-gameframe.cascade-blitz-return:v1";
  const LIFE_MAX = 5;

  const storage = window.localStorage;
  const session = window.sessionStorage;
  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;

  function readJson(target, key) {
    try {
      const parsed = JSON.parse(nativeGetItem.call(target, key) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function readQueueStart() {
    const value = Number(nativeGetItem.call(storage, LIFE_QUEUE_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function writeQueueStart(value) {
    const timestamp = Number(value);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      nativeSetItem.call(storage, LIFE_QUEUE_KEY, String(timestamp));
    } else {
      nativeRemoveItem.call(storage, LIFE_QUEUE_KEY);
    }
  }

  function restoreInterruptedBlitz() {
    const snapshot = nativeGetItem.call(session, BLITZ_RETURN_KEY);
    const active = nativeGetItem.call(storage, ACTIVE_RUN_KEY);
    if (!snapshot || active) return;
    nativeSetItem.call(storage, ACTIVE_RUN_KEY, snapshot);
    nativeRemoveItem.call(session, BLITZ_RETURN_KEY);
  }

  function reconcileLifeQueueBeforeRuntime() {
    const state = readJson(storage, STATE_KEY);
    if (!state) return;
    const lives = Math.max(0, Math.min(LIFE_MAX, Number(state.lives) || 0));
    if (lives >= LIFE_MAX) {
      writeQueueStart(0);
      return;
    }

    const storedStart = Number(state.lastLifeAt);
    const queueStart = readQueueStart() || (Number.isFinite(storedStart) && storedStart > 0 ? storedStart : Date.now());
    state.lastLifeAt = queueStart;
    writeQueueStart(queueStart);
    nativeSetItem.call(storage, STATE_KEY, JSON.stringify(state));
  }

  restoreInterruptedBlitz();
  reconcileLifeQueueBeforeRuntime();

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    if (this !== storage || key !== STATE_KEY) {
      return nativeSetItem.call(this, key, value);
    }

    try {
      const previous = readJson(storage, STATE_KEY);
      const next = JSON.parse(String(value));
      if (!next || typeof next !== "object") return nativeSetItem.call(this, key, value);

      const previousLives = Math.max(0, Math.min(LIFE_MAX, Number(previous?.lives) || 0));
      const nextLives = Math.max(0, Math.min(LIFE_MAX, Number(next.lives) || 0));
      let queueStart = readQueueStart();

      if (nextLives >= LIFE_MAX) {
        queueStart = 0;
      } else if (nextLives < previousLives) {
        if (previousLives >= LIFE_MAX || !queueStart) {
          queueStart = Number(next.lastLifeAt) || Date.now();
        }
        next.lastLifeAt = queueStart;
      } else if (nextLives > previousLives) {
        queueStart = Number(next.lastLifeAt) || queueStart || Date.now();
        next.lastLifeAt = queueStart;
      } else if (queueStart) {
        next.lastLifeAt = queueStart;
      } else {
        queueStart = Number(next.lastLifeAt) || Date.now();
        next.lastLifeAt = queueStart;
      }

      writeQueueStart(queueStart);
      return nativeSetItem.call(this, key, JSON.stringify(next));
    } catch {
      return nativeSetItem.call(this, key, value);
    }
  };

  window.cascadeFamilyState = Object.freeze({
    lifeQueueKey: LIFE_QUEUE_KEY,
    blitzReturnKey: BLITZ_RETURN_KEY,
  });
})();
