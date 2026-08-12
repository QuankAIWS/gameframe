const board = document.querySelector("#board");
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
const palette = ["#ff5eaa", "#44c9ee", "#ffd34e", "#69d877", "#a56af4", "#ff914d"];
const particles = [];
const waves = [];
const pendingClears = new Set();
const pendingSpecials = new Set();
const seenClears = new WeakSet();
const seenSpecials = new WeakSet();
const metrics = {
  bursts: 0,
  peakParticles: 0,
  lastBurstParticles: 0,
  frames: 0,
};

let canvas = null;
let context = null;
let frameHandle = 0;
let lastFrameAt = 0;
let flushQueued = false;
let viewportWidth = 0;
let viewportHeight = 0;
let dpr = 1;

function effectsMode() {
  return reducedMotion ? "reduced" : document.body.dataset.cascadeEffects === "reduced" ? "reduced" : "full";
}

function particleBudget() {
  return effectsMode() === "full" ? 360 : 90;
}

function currentCascade() {
  const text = document.querySelector("#combo-label")?.textContent || "";
  const match = text.match(/×(\d+)/);
  return match ? Math.max(1, Number(match[1]) || 1) : 1;
}

function tileColor(tile) {
  const kind = Number(tile?.dataset?.kind);
  return palette[Number.isInteger(kind) ? ((kind % palette.length) + palette.length) % palette.length : 0];
}

function ensureCanvas() {
  if (canvas?.isConnected && context) return canvas;
  canvas = document.createElement("canvas");
  canvas.className = "cascade-dopamine-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  resizeCanvas();
  return canvas;
}

function resizeCanvas() {
  if (!canvas || !context) return;
  viewportWidth = Math.max(1, window.innerWidth);
  viewportHeight = Math.max(1, window.innerHeight);
  dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(viewportHeight * dpr);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function addWave(x, y, color, intensity = 1) {
  if (waves.length >= 18) waves.shift();
  waves.push({
    x,
    y,
    color,
    age: 0,
    life: 0.62 + intensity * 0.11,
    startRadius: 18 + intensity * 7,
    endRadius: 170 + intensity * 92,
    width: 3.5 + intensity * 1.35,
  });
}

function addParticle(x, y, color, intensity, cascade, ordinal) {
  if (particles.length >= particleBudget()) return false;
  const angle = Math.random() * Math.PI * 2;
  const speed = 300 + Math.random() * (410 + intensity * 155 + Math.min(cascade, 5) * 68);
  const upwardBias = 60 + Math.random() * 150;
  const life = 0.78 + Math.random() * 0.62 + intensity * 0.08;
  const size = 3.2 + Math.random() * (5.6 + intensity * 1.55);
  particles.push({
    x,
    y,
    previousX: x,
    previousY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - upwardBias,
    gravity: 150 + Math.random() * 230,
    drag: 0.978 + Math.random() * 0.012,
    age: 0,
    life,
    size,
    color,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 11,
    shape: ordinal % 5 === 0 ? "ribbon" : ordinal % 3 === 0 ? "square" : "dot",
  });
  return true;
}

function emitBurst(x, y, color, intensity = 1, cascade = 1, multiplier = 1) {
  if (reducedMotion) return 0;
  ensureCanvas();
  const full = effectsMode() === "full";
  const base = full ? 20 : 7;
  const requested = Math.round((base + intensity * (full ? 9 : 3) + Math.min(cascade, 5) * (full ? 5 : 1)) * multiplier);
  let emitted = 0;
  for (let index = 0; index < requested; index += 1) {
    if (!addParticle(x, y, color, intensity, cascade, index)) break;
    emitted += 1;
  }
  addWave(x, y, color, intensity);
  metrics.bursts += 1;
  metrics.lastBurstParticles = emitted;
  metrics.peakParticles = Math.max(metrics.peakParticles, particles.length);
  startAnimation();
  return emitted;
}

function emitBoardBurst(samples, cascade) {
  if (!samples.length || effectsMode() !== "full" || cascade < 2) return;
  const x = samples.reduce((sum, sample) => sum + sample.x, 0) / samples.length;
  const y = samples.reduce((sum, sample) => sum + sample.y, 0) / samples.length;
  const color = palette[Math.min(palette.length - 1, cascade)];
  const multiplier = cascade >= 4 ? 1.45 : 0.8;
  emitBurst(x, y, color, Math.min(3, Math.max(2, cascade - 1)), cascade, multiplier);
}

function drawParticle(particle, alpha) {
  const ctx = context;
  if (!ctx) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = particle.color;
  ctx.strokeStyle = particle.color;
  if (particle.shape === "ribbon") {
    ctx.lineWidth = Math.max(1.5, particle.size * 0.42);
    ctx.beginPath();
    ctx.moveTo(particle.previousX, particle.previousY);
    ctx.lineTo(particle.x, particle.y);
    ctx.stroke();
    return;
  }
  if (particle.shape === "square") {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawWave(wave) {
  const ctx = context;
  if (!ctx) return;
  const progress = Math.min(1, wave.age / wave.life);
  const radius = wave.startRadius + (wave.endRadius - wave.startRadius) * (1 - Math.pow(1 - progress, 2));
  ctx.globalAlpha = Math.max(0, 0.84 * (1 - progress));
  ctx.strokeStyle = wave.color;
  ctx.lineWidth = wave.width * (1 - progress * 0.5);
  ctx.beginPath();
  ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function animate(now) {
  frameHandle = 0;
  if (!context || !canvas) return;
  const dt = Math.min(0.034, lastFrameAt ? (now - lastFrameAt) / 1000 : 0.016);
  lastFrameAt = now;
  metrics.frames += 1;
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  context.globalCompositeOperation = "lighter";

  for (let index = waves.length - 1; index >= 0; index -= 1) {
    const wave = waves[index];
    wave.age += dt;
    if (wave.age >= wave.life) {
      waves.splice(index, 1);
      continue;
    }
    drawWave(wave);
  }

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.age += dt;
    if (particle.age >= particle.life) {
      particles.splice(index, 1);
      continue;
    }
    particle.previousX = particle.x;
    particle.previousY = particle.y;
    particle.vx *= Math.pow(particle.drag, dt * 60);
    particle.vy = particle.vy * Math.pow(particle.drag, dt * 60) + particle.gravity * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.rotation += particle.spin * dt;
    const progress = particle.age / particle.life;
    const alpha = progress < 0.1 ? progress / 0.1 : Math.pow(1 - progress, 0.58);
    drawParticle(particle, Math.max(0, alpha));
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  if (particles.length || waves.length) frameHandle = requestAnimationFrame(animate);
  else lastFrameAt = 0;
}

function startAnimation() {
  if (!frameHandle && (particles.length || waves.length)) frameHandle = requestAnimationFrame(animate);
}

function flushEffects() {
  flushQueued = false;
  const clearTiles = [...pendingClears];
  const specialTiles = [...pendingSpecials];
  pendingClears.clear();
  pendingSpecials.clear();
  if (!clearTiles.length && !specialTiles.length) return;

  // Batch all geometry reads before emitting particles so we do not alternate
  // DOM measurement and canvas writes during a large match.
  const cascade = currentCascade();
  const samples = clearTiles.map((tile) => {
    const rect = tile.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      color: tileColor(tile),
      intensity: tile.dataset.special || cascade >= 3 ? 3 : cascade >= 2 ? 2 : 1,
    };
  });
  const specialSamples = specialTiles.map((tile) => {
    const rect = tile.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      color: tileColor(tile),
    };
  });

  for (const sample of samples) emitBurst(sample.x, sample.y, sample.color, sample.intensity, cascade);
  for (const sample of specialSamples) emitBurst(sample.x, sample.y, sample.color, 3, Math.max(2, cascade), 1.35);
  emitBoardBurst(samples, cascade);
}

function scheduleFlush() {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(flushEffects);
}

function handleBoardMutations(mutations) {
  for (const mutation of mutations) {
    if (mutation.type !== "attributes") continue;
    const tile = mutation.target;
    if (!(tile instanceof HTMLElement) || !tile.classList.contains("cascade-tile")) continue;
    if (tile.classList.contains("is-clearing")) {
      if (!seenClears.has(tile)) {
        seenClears.add(tile);
        pendingClears.add(tile);
      }
    } else {
      seenClears.delete(tile);
    }
    if (tile.classList.contains("is-special-triggered")) {
      if (!seenSpecials.has(tile)) {
        seenSpecials.add(tile);
        pendingSpecials.add(tile);
      }
    } else {
      seenSpecials.delete(tile);
    }
  }
  if (pendingClears.size || pendingSpecials.size) scheduleFlush();
}

function clearAnimation() {
  particles.length = 0;
  waves.length = 0;
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  lastFrameAt = 0;
  context?.clearRect(0, 0, viewportWidth, viewportHeight);
}

if (board) {
  new MutationObserver(handleBoardMutations).observe(board, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

window.addEventListener("resize", resizeCanvas, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearAnimation();
});

window.cascadeDopamineVfx = Object.freeze({
  getStats() {
    return {
      ...metrics,
      activeParticles: particles.length,
      activeWaves: waves.length,
      particleBudget: particleBudget(),
      canvasCount: document.querySelectorAll(".cascade-dopamine-canvas").length,
    };
  },
  demo(intensity = 3) {
    const rect = board?.getBoundingClientRect();
    if (!rect) return false;
    emitBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, palette[0], Math.max(1, Math.min(3, intensity)), 4, 1.8);
    return true;
  },
});
