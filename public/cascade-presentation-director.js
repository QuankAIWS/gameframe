const SOUND_KEY = "scribbles-gameframe.cascade-sound:v1";
const EFFECTS_KEY = "scribbles-gameframe.cascade-effects:v1";
const palette = ["#ff5eaa", "#44c9ee", "#ffd34e", "#69d877", "#a56af4", "#ff914d"];
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

let soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
let effectsMode = localStorage.getItem(EFFECTS_KEY) === "reduced" ? "reduced" : "full";
let audioContext = null;
let canvas = null;
let context = null;
let frameHandle = 0;
let lastFrameAt = 0;
let viewportWidth = 0;
let viewportHeight = 0;
let dpr = 1;
let hypeToken = 0;
const particles = [];
const waves = [];
const metrics = {
  transitions: 0,
  clears: 0,
  specialBirths: 0,
  specialTriggers: 0,
  rewardSequences: 0,
  bursts: 0,
  peakParticles: 0,
  lastBurstParticles: 0,
  frames: 0,
};

function effectiveEffectsMode() {
  return reducedMotion ? "reduced" : effectsMode;
}

function particleBudget() {
  return effectiveEffectsMode() === "full" ? 360 : 90;
}

function applyEffectsMode() {
  document.body.dataset.cascadeEffects = effectiveEffectsMode();
  const button = document.querySelector("#cascade-effects-toggle");
  if (button) updateEffectsButton(button);
}

function getAudioContext() {
  if (!soundEnabled) return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      audioContext = new AudioContextClass();
    } catch {
      return null;
    }
  }
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function tone(frequency, duration = .08, volume = .03, type = "sine", delay = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .025);
}

function noiseBurst(duration = .05, volume = .009, highpass = 520, lowpass = 6200) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const decay = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * decay;
  }
  const source = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const lp = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  hp.type = "highpass";
  hp.frequency.value = highpass;
  lp.type = "lowpass";
  lp.frequency.value = lowpass;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(Math.max(.0001, volume), now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  source.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
}

function bodyThump(frequency = 105, duration = .1, volume = .018) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * .55), now + duration);
  gain.gain.setValueAtTime(Math.max(.0001, volume), now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + .025);
}

function playClear(count, tier, cascade) {
  const base = 420 + Math.min(6, cascade) * 68;
  tone(base, .075, .022 + tier * .004, "sine");
  tone(base * 1.25, .09, .016 + tier * .003, "triangle", .02);
  if (count >= 8 || tier >= 2) tone(base * 1.5, .13, .02, "sine", .045);
  if (tier >= 3) bodyThump(112 + tier * 8, .12, .014 + tier * .004);
  noiseBurst(.04 + tier * .012, .004 + tier * .002, 650, 5200 + count * 70);
}

function playSpecial(type) {
  if (type === "color") {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, .13, .023, index % 2 ? "triangle" : "sine", index * .035));
    noiseBurst(.16, .01, 1500, 9800);
  } else if (type === "bomb") {
    bodyThump(88, .17, .03);
    noiseBurst(.1, .017, 140, 2600);
    tone(330, .1, .022, "triangle", .035);
  } else {
    noiseBurst(.11, .012, 900, 7600);
    tone(540, .085, .023, "triangle");
    tone(940, .1, .02, "sine", .03);
  }
}

function playWin(finalRun = false) {
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, .18, .031, "triangle", index * .075));
  if (finalRun) [659.25, 783.99, 987.77, 1318.51].forEach((frequency, index) => tone(frequency, .22, .025, "sine", .32 + index * .085));
}

function playFail() {
  tone(330, .12, .023, "triangle");
  tone(247, .16, .02, "triangle", .09);
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
  waves.push({ x, y, color, age: 0, life: .6 + intensity * .1, startRadius: 18 + intensity * 7, endRadius: 150 + intensity * 88, width: 3 + intensity * 1.2 });
}

function addParticle(x, y, color, intensity, cascade, ordinal) {
  if (particles.length >= particleBudget()) return false;
  const angle = Math.random() * Math.PI * 2;
  const speed = 280 + Math.random() * (380 + intensity * 145 + Math.min(cascade, 6) * 60);
  particles.push({
    x,
    y,
    previousX: x,
    previousY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 55 - Math.random() * 150,
    gravity: 160 + Math.random() * 220,
    drag: .978 + Math.random() * .012,
    age: 0,
    life: .72 + Math.random() * .55 + intensity * .07,
    size: 3 + Math.random() * (5 + intensity * 1.4),
    color,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - .5) * 11,
    shape: ordinal % 5 === 0 ? "ribbon" : ordinal % 3 === 0 ? "square" : "dot",
  });
  return true;
}

function emitBurst(x, y, color, intensity = 1, cascade = 1, multiplier = 1) {
  if (reducedMotion) return 0;
  ensureCanvas();
  const full = effectiveEffectsMode() === "full";
  const base = full ? 18 : 6;
  const requested = Math.round((base + intensity * (full ? 8 : 3) + Math.min(cascade, 6) * (full ? 4 : 1)) * multiplier);
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

function drawParticle(particle, alpha) {
  if (!context) return;
  context.globalAlpha = alpha;
  context.fillStyle = particle.color;
  context.strokeStyle = particle.color;
  if (particle.shape === "ribbon") {
    context.lineWidth = Math.max(1.5, particle.size * .42);
    context.beginPath();
    context.moveTo(particle.previousX, particle.previousY);
    context.lineTo(particle.x, particle.y);
    context.stroke();
  } else if (particle.shape === "square") {
    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);
    context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    context.restore();
  } else {
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
    context.fill();
  }
}

function drawWave(wave) {
  if (!context) return;
  const progress = Math.min(1, wave.age / wave.life);
  const radius = wave.startRadius + (wave.endRadius - wave.startRadius) * (1 - Math.pow(1 - progress, 2));
  context.globalAlpha = Math.max(0, .82 * (1 - progress));
  context.strokeStyle = wave.color;
  context.lineWidth = wave.width * (1 - progress * .5);
  context.beginPath();
  context.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
  context.stroke();
}

function animate(now) {
  frameHandle = 0;
  if (!context || !canvas) return;
  const dt = Math.min(.034, lastFrameAt ? (now - lastFrameAt) / 1000 : .016);
  lastFrameAt = now;
  metrics.frames += 1;
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  context.globalCompositeOperation = "lighter";
  for (let index = waves.length - 1; index >= 0; index -= 1) {
    const wave = waves[index];
    wave.age += dt;
    if (wave.age >= wave.life) waves.splice(index, 1);
    else drawWave(wave);
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
    const alpha = progress < .1 ? progress / .1 : Math.pow(1 - progress, .58);
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

function clearAnimation() {
  particles.length = 0;
  waves.length = 0;
  if (frameHandle) cancelAnimationFrame(frameHandle);
  frameHandle = 0;
  lastFrameAt = 0;
  context?.clearRect(0, 0, viewportWidth, viewportHeight);
}

function tileAt(index) {
  return document.querySelector(`#board .cascade-tile[data-index="${index}"]`);
}

function tileCenter(tile) {
  const rect = tile?.getBoundingClientRect?.();
  if (!rect) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
}

function tileColor(tile) {
  const kind = Number(tile?.dataset?.kind);
  return palette[Number.isInteger(kind) ? ((kind % palette.length) + palette.length) % palette.length : 0];
}

function ensureJuiceLayer() {
  let layer = document.querySelector(".cascade-juice-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "cascade-juice-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }
  return layer;
}

function ensureHypeLayer() {
  const wrap = document.querySelector(".cascade-board-wrap");
  if (!wrap) return null;
  let layer = wrap.querySelector(".cascade-hype-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "cascade-hype-layer";
    layer.setAttribute("aria-hidden", "true");
    wrap.append(layer);
  }
  return layer;
}

function spawnPopBurst(tile, intensity = 1) {
  if (reducedMotion || !tile) return;
  const center = tileCenter(tile);
  if (!center) return;
  const burst = document.createElement("div");
  burst.className = "cascade-pop-burst";
  burst.dataset.intensity = String(Math.max(1, Math.min(3, intensity)));
  burst.style.setProperty("--juice-x", `${center.x}px`);
  burst.style.setProperty("--juice-y", `${center.y}px`);
  burst.style.setProperty("--juice-color", tileColor(tile));
  const ring = document.createElement("span");
  ring.className = "cascade-pop-ring";
  burst.append(ring);
  const count = effectiveEffectsMode() === "reduced" ? 5 : intensity >= 3 ? 15 : intensity === 2 ? 10 : 7;
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement("i");
    spark.className = "cascade-pop-spark";
    spark.style.setProperty("--spark-angle", `${(360 / count) * index + (Math.random() * 14 - 7)}deg`);
    spark.style.setProperty("--spark-distance", `${26 + intensity * 14 + Math.random() * (18 + intensity * 8)}px`);
    spark.style.setProperty("--spark-size", `${4 + Math.random() * (intensity >= 2 ? 7 : 4)}px`);
    spark.style.setProperty("--spark-delay", `${Math.random() * 38}ms`);
    spark.style.setProperty("--spark-duration", `${430 + Math.random() * 170}ms`);
    burst.append(spark);
  }
  ensureJuiceLayer().append(burst);
  window.setTimeout(() => burst.remove(), 760);
}

function spawnStripeBeam(tile, type) {
  const board = document.querySelector("#board");
  const center = tileCenter(tile);
  const boardRect = board?.getBoundingClientRect();
  if (!center || !boardRect || reducedMotion) return;
  const beam = document.createElement("div");
  const horizontal = type === "stripe-h";
  beam.className = `cascade-stripe-beam ${horizontal ? "is-horizontal" : "is-vertical"}`;
  beam.style.setProperty("--juice-color", tileColor(tile));
  if (horizontal) {
    beam.style.left = `${boardRect.left}px`;
    beam.style.top = `${center.y - Math.max(4, center.rect.height * .08)}px`;
    beam.style.width = `${boardRect.width}px`;
    beam.style.height = `${Math.max(8, center.rect.height * .16)}px`;
  } else {
    beam.style.left = `${center.x - Math.max(4, center.rect.width * .08)}px`;
    beam.style.top = `${boardRect.top}px`;
    beam.style.width = `${Math.max(8, center.rect.width * .16)}px`;
    beam.style.height = `${boardRect.height}px`;
  }
  ensureJuiceLayer().append(beam);
  window.setTimeout(() => beam.remove(), 560);
}

function spawnBombImpact(tile) {
  const center = tileCenter(tile);
  if (!center || reducedMotion) return;
  const effect = document.createElement("div");
  effect.className = "cascade-impact-bomb";
  effect.style.setProperty("--juice-x", `${center.x}px`);
  effect.style.setProperty("--juice-y", `${center.y}px`);
  effect.style.setProperty("--juice-color", tileColor(tile));
  const ring = document.createElement("span");
  ring.className = "cascade-bomb-ring";
  effect.append(ring);
  ensureJuiceLayer().append(effect);
  window.setTimeout(() => effect.remove(), 760);
}

function spawnColorSweep(tile) {
  const board = document.querySelector("#board");
  const rect = board?.getBoundingClientRect();
  if (!rect || reducedMotion) return;
  const wash = document.createElement("div");
  wash.className = "cascade-color-wash";
  wash.style.left = `${rect.left}px`;
  wash.style.top = `${rect.top}px`;
  wash.style.width = `${rect.width}px`;
  wash.style.height = `${rect.height}px`;
  wash.style.setProperty("--juice-color", tileColor(tile));
  ensureJuiceLayer().append(wash);
  window.setTimeout(() => wash.remove(), 760);
}

function spawnSpecialBirth(index, type) {
  const tile = tileAt(index);
  const center = tileCenter(tile);
  if (!tile || !center || reducedMotion) return;
  metrics.specialBirths += 1;
  tile.classList.add("is-special-born");
  window.setTimeout(() => tile.classList.remove("is-special-born"), 720);
  const birth = document.createElement("div");
  birth.className = "cascade-special-birth";
  birth.dataset.special = type;
  birth.style.setProperty("--juice-x", `${center.x}px`);
  birth.style.setProperty("--juice-y", `${center.y}px`);
  birth.style.setProperty("--juice-color", type === "color" ? "#ff5eaa" : tileColor(tile));
  const ring = document.createElement("span");
  ring.className = "cascade-birth-ring";
  birth.append(ring);
  ensureJuiceLayer().append(birth);
  window.setTimeout(() => birth.remove(), 900);
}

function impact(level = 1) {
  if (effectiveEffectsMode() !== "full") return;
  const wrap = document.querySelector(".cascade-board-wrap");
  if (!wrap) return;
  const className = level >= 3 ? "is-juice-impact-big" : level === 2 ? "is-juice-impact-medium" : "is-juice-impact-small";
  wrap.classList.remove("is-juice-impact-small", "is-juice-impact-medium", "is-juice-impact-big");
  void wrap.offsetWidth;
  wrap.classList.add(className);
  window.setTimeout(() => wrap.classList.remove(className), level >= 3 ? 280 : 230);
}

function showHype(text, tier = 2, subtext = "") {
  if (!text || reducedMotion) return;
  const layer = ensureHypeLayer();
  const wrap = document.querySelector(".cascade-board-wrap");
  if (!layer || !wrap) return;
  const token = ++hypeToken;
  layer.querySelectorAll(".cascade-hype-word").forEach((node) => node.remove());
  const word = document.createElement("div");
  word.className = "cascade-hype-word";
  word.style.setProperty("--hype-color", palette[(tier + 1) % palette.length]);
  word.style.setProperty("--hype-duration", tier >= 4 ? "1180ms" : "920ms");
  word.append(document.createTextNode(text));
  if (subtext) {
    const small = document.createElement("small");
    small.textContent = subtext;
    word.append(small);
  }
  layer.append(word);
  wrap.dataset.juiceHype = String(Math.max(2, Math.min(4, tier)));
  wrap.style.setProperty("--juice-hype-color", palette[(tier + 1) % palette.length]);
  window.setTimeout(() => {
    word.remove();
    if (token === hypeToken) delete wrap.dataset.juiceHype;
  }, tier >= 4 ? 1260 : 1020);
}

function tierFor(transition) {
  if (transition?.combo) return 4;
  if ((transition?.triggeredSpecials?.length || 0) > 0) return Math.max(3, Math.min(4, transition.cascade || 1));
  if ((transition?.cascade || 1) >= 5) return 4;
  if ((transition?.cascade || 1) >= 3) return 3;
  if ((transition?.cascade || 1) === 2 || (transition?.createdSpecials?.length || 0) > 0 || (transition?.matched?.length || 0) >= 5) return 2;
  return 1;
}

function setCombo(transition) {
  const label = document.querySelector("#combo-label");
  if (!label) return;
  label.classList.remove("is-hot", "is-wild");
  if (transition.combo) {
    label.textContent = transition.combo.toUpperCase();
    label.classList.add("is-wild");
  } else if (transition.cascade <= 1) {
    label.textContent = transition.createdSpecials?.length ? "SPECIAL MADE" : "MATCH";
  } else {
    label.textContent = `CASCADE ×${transition.cascade}`;
    if (transition.cascade >= 3) label.classList.add("is-hot");
    if (transition.cascade >= 5) label.classList.add("is-wild");
  }
}

function transitionStart(transition) {
  metrics.transitions += 1;
  setCombo(transition);
  const tier = tierFor(transition);
  if (transition.combo) showHype("Power Combo!", 4, transition.combo.replaceAll("-", " "));
  else if (transition.cascade === 2) showHype("Nice!", 2, "Cascade ×2");
  else if (transition.cascade === 3) showHype("Sweet!", 3, "Cascade ×3");
  else if (transition.cascade === 4) showHype("Huge!", 3, "Cascade ×4");
  else if (transition.cascade >= 5) showHype("Mega!", 4, `Cascade ×${transition.cascade}`);
  if (tier >= 3) impact(tier >= 4 ? 3 : 2);
}

function transitionClear(transition) {
  metrics.clears += 1;
  const tier = tierFor(transition);
  const cascade = Math.max(1, Number(transition.cascade) || 1);
  const tiles = (transition.matched || []).map(tileAt).filter(Boolean);
  const centers = [];
  for (const tile of tiles) {
    const center = tileCenter(tile);
    if (!center) continue;
    centers.push(center);
    const intensity = Math.min(3, tier);
    spawnPopBurst(tile, intensity);
    emitBurst(center.x, center.y, tileColor(tile), intensity, cascade, tier >= 4 ? 1.15 : 1);
  }
  if (centers.length && cascade >= 2 && effectiveEffectsMode() === "full") {
    const x = centers.reduce((sum, center) => sum + center.x, 0) / centers.length;
    const y = centers.reduce((sum, center) => sum + center.y, 0) / centers.length;
    emitBurst(x, y, palette[Math.min(palette.length - 1, cascade)], Math.min(3, tier), cascade, cascade >= 4 ? 1.35 : .7);
  }
  playClear(tiles.length, tier, cascade);

  let strongest = "";
  const priority = (type) => type === "color" ? 3 : type === "bomb" ? 2 : type?.startsWith("stripe") ? 1 : 0;
  for (const trigger of transition.triggeredSpecials || []) {
    const tile = tileAt(trigger.index);
    const type = trigger.special || tile?.dataset.special || "";
    metrics.specialTriggers += 1;
    if (type === "bomb") spawnBombImpact(tile);
    else if (type === "color") spawnColorSweep(tile);
    else if (type === "stripe-h" || type === "stripe-v") spawnStripeBeam(tile, type);
    if (priority(type) > priority(strongest)) strongest = type;
  }
  if (strongest) playSpecial(strongest);
  if (tier >= 2) impact(tier >= 4 ? 3 : tier >= 3 ? 2 : 1);
}

function createdSpecialIndex(creation, transition) {
  const fall = (transition.falls || []).find((item) => item.from === creation.index && item.special === creation.special);
  return fall?.to ?? creation.index;
}

function transitionAfterFall(transition) {
  for (const creation of transition.createdSpecials || []) {
    const index = createdSpecialIndex(creation, transition);
    spawnSpecialBirth(index, creation.special);
    playSpecial(creation.special);
  }
}

function transitionLand(transition, indices = []) {
  const tier = tierFor(transition);
  if (indices.length && tier >= 2) tone(235 + tier * 38, .045, .008 + tier * .002, "triangle");
}

function invalidSwap() {
  tone(210, .06, .012, "triangle");
}

function hammer(index) {
  const tile = tileAt(index);
  const center = tileCenter(tile);
  bodyThump(92, .15, .027);
  noiseBurst(.08, .014, 180, 2900);
  if (center) emitBurst(center.x, center.y, tileColor(tile), 3, 1, 1.25);
  impact(2);
}

function celebrate(finalRun = false) {
  if (reducedMotion) return;
  document.querySelector(".cascade-confetti-layer")?.remove();
  document.querySelector(".cascade-win-bloom")?.remove();
  const layer = document.createElement("div");
  layer.className = "cascade-confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  const count = effectiveEffectsMode() === "reduced" ? (finalRun ? 28 : 20) : (finalRun ? 82 : 48);
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("i");
    piece.className = "cascade-confetti-piece";
    piece.style.setProperty("--x", `${2 + Math.random() * 96}%`);
    piece.style.setProperty("--w", `${7 + Math.random() * 11}px`);
    piece.style.setProperty("--confetti", palette[index % palette.length]);
    piece.style.setProperty("--duration", `${1.8 + Math.random() * 1.5}s`);
    piece.style.setProperty("--delay", `${Math.random() * .35}s`);
    piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    piece.style.setProperty("--spin", `${360 + Math.round(Math.random() * 860)}deg`);
    layer.append(piece);
  }
  document.body.append(layer);
  if (effectiveEffectsMode() === "full") {
    const bloom = document.createElement("div");
    bloom.className = "cascade-win-bloom";
    bloom.setAttribute("aria-hidden", "true");
    document.body.append(bloom);
    window.setTimeout(() => bloom.remove(), 1400);
  }
  window.setTimeout(() => layer.remove(), 4000);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? Math.min(20, ms) : ms));
}

function ensureRewardStage() {
  const wrap = document.querySelector(".cascade-board-wrap");
  if (!wrap) return null;
  let stage = wrap.querySelector(".cascade-reward-stage");
  if (stage) return stage;
  stage = document.createElement("div");
  stage.className = "cascade-reward-stage";
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = `
    <div class="cascade-reward-panel">
      <small class="cascade-reward-kicker">LEVEL CLEARED</small>
      <strong class="cascade-reward-title">Crushed it.</strong>
      <div class="cascade-reward-cashout">
        <span>UNUSED MOVES</span>
        <b data-reward-moves>0</b>
        <em>× 100</em>
      </div>
      <div class="cascade-reward-score" data-reward-score>+0</div>
      <div class="cascade-reward-stars" aria-label="Run stars">
        <i>★</i><i>★</i><i>★</i>
      </div>
      <div class="cascade-reward-hammer" data-reward-hammer hidden>🔨 Hammer earned</div>
    </div>`;
  wrap.append(stage);
  return stage;
}

async function presentLevelComplete({ moves = 0, scoreBeforeBonus = 0, scoreAfterBonus = scoreBeforeBonus, stars = 1, reward = {}, finalRun = false } = {}) {
  metrics.rewardSequences += 1;
  const stage = ensureRewardStage();
  const scoreElement = document.querySelector("#score");
  const movesElement = document.querySelector("#moves");
  if (!stage) return;
  const panel = stage.querySelector(".cascade-reward-panel");
  const moveValue = stage.querySelector("[data-reward-moves]");
  const bonusValue = stage.querySelector("[data-reward-score]");
  const starNodes = [...stage.querySelectorAll(".cascade-reward-stars i")];
  const hammer = stage.querySelector("[data-reward-hammer]");
  stage.querySelector(".cascade-reward-kicker").textContent = finalRun ? "RUN COMPLETE" : "LEVEL CLEARED";
  stage.querySelector(".cascade-reward-title").textContent = finalRun ? "All 300 crushed." : "Crushed it.";
  moveValue.textContent = String(Math.max(0, moves));
  bonusValue.textContent = "+0";
  starNodes.forEach((node) => node.classList.remove("is-earned"));
  hammer.hidden = true;
  panel.classList.remove("is-cashing", "is-stars", "is-reward");
  stage.classList.add("is-active");
  celebrate(finalRun);
  playWin(finalRun);
  showHype(finalRun ? "Run Crushed!" : "Level Clear!", 4, moves > 0 ? `${moves} moves left` : "Objective complete");
  impact(3);
  await wait(360);

  panel.classList.add("is-cashing");
  const safeMoves = Math.max(0, Number(moves) || 0);
  const steps = safeMoves ? Math.min(safeMoves, 12) : 1;
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const visibleMoves = safeMoves ? Math.max(0, Math.round(safeMoves * (1 - progress))) : 0;
    const visibleScore = Math.round(scoreBeforeBonus + (scoreAfterBonus - scoreBeforeBonus) * progress);
    moveValue.textContent = String(visibleMoves);
    bonusValue.textContent = `+${Math.round((scoreAfterBonus - scoreBeforeBonus) * progress).toLocaleString()}`;
    if (scoreElement) scoreElement.textContent = visibleScore.toLocaleString();
    if (movesElement) movesElement.textContent = String(visibleMoves);
    tone(520 + step * 22, .045, .012, "triangle");
    if (step === steps || step % 3 === 0) impact(step === steps ? 2 : 1);
    await wait(85);
  }
  if (scoreElement) scoreElement.textContent = Number(scoreAfterBonus).toLocaleString();
  if (movesElement) movesElement.textContent = String(Math.max(0, moves));
  await wait(180);

  panel.classList.add("is-stars");
  for (let index = 0; index < Math.max(0, Math.min(3, Number(stars) || 0)); index += 1) {
    starNodes[index].classList.add("is-earned");
    tone([659.25, 783.99, 1046.5][index], .16, .028, "triangle");
    if (!reducedMotion) {
      const rect = starNodes[index].getBoundingClientRect();
      emitBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, palette[2], 2 + (index === 2 ? 1 : 0), 2 + index, 1.15);
    }
    await wait(260);
  }

  if (reward.claimed) {
    hammer.hidden = false;
    hammer.textContent = `🔨 +${reward.claimed} hammer earned`;
    panel.classList.add("is-reward");
    bodyThump(118, .14, .02);
    tone(880, .16, .028, "triangle", .03);
    await wait(420);
  }
  await wait(260);
  stage.classList.remove("is-active");
  await wait(180);
}

async function presentBlitzComplete({ score = 0, stars = 0, reward = {} } = {}) {
  metrics.rewardSequences += 1;
  celebrate(false);
  showHype("Blitz Complete!", 4, `${Number(score).toLocaleString()} points`);
  playWin(false);
  impact(3);
  if (reward.claimed) {
    await wait(260);
    showHype("Hammer!", 3, `+${reward.claimed} earned`);
  }
  await wait(reducedMotion ? 20 : Math.max(400, Math.min(900, 250 + stars * 180)));
}

function failure() {
  playFail();
}

function updateSoundButton(button) {
  button.textContent = soundEnabled ? "🔊 Sound on" : "🔇 Sound off";
  button.setAttribute("aria-pressed", String(soundEnabled));
}

function updateEffectsButton(button) {
  const reduced = effectiveEffectsMode() === "reduced";
  button.textContent = reduced ? "✨ Effects reduced" : "✨ Effects full";
  button.setAttribute("aria-pressed", String(reduced));
  button.title = reducedMotion ? "Your device requests reduced motion." : "Toggle full or reduced visual effects.";
}

function installFeedbackControls() {
  const side = document.querySelector(".cascade-side");
  if (!side || document.querySelector("#cascade-feedback-card")) return;
  const card = document.createElement("div");
  card.id = "cascade-feedback-card";
  card.className = "cascade-card cascade-feedback-card";
  const label = document.createElement("small");
  label.textContent = "SETTINGS";
  const controls = document.createElement("div");
  controls.className = "cascade-feedback-controls";
  const soundButton = document.createElement("button");
  soundButton.type = "button";
  soundButton.id = "cascade-sound-toggle";
  updateSoundButton(soundButton);
  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
    updateSoundButton(soundButton);
    if (soundEnabled) {
      getAudioContext();
      tone(523.25, .08, .025, "triangle");
      tone(659.25, .09, .02, "triangle", .06);
    }
  });
  const effectsButton = document.createElement("button");
  effectsButton.type = "button";
  effectsButton.id = "cascade-effects-toggle";
  updateEffectsButton(effectsButton);
  effectsButton.addEventListener("click", () => {
    effectsMode = effectsMode === "reduced" ? "full" : "reduced";
    localStorage.setItem(EFFECTS_KEY, effectsMode);
    applyEffectsMode();
    if (effectiveEffectsMode() === "full") showHype("Pop!", 2, "Full effects");
  });
  controls.append(soundButton, effectsButton);
  card.append(label, controls);
  side.append(card);
}

function reset() {
  document.querySelector(".cascade-reward-stage")?.classList.remove("is-active");
  document.querySelector("#combo-label")?.classList.remove("is-hot", "is-wild");
  const combo = document.querySelector("#combo-label");
  if (combo) combo.textContent = "";
  clearAnimation();
}

function demo(intensity = 3) {
  const board = document.querySelector("#board");
  const rect = board?.getBoundingClientRect();
  if (!rect) return false;
  emitBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, palette[0], Math.max(1, Math.min(3, intensity)), 4, 1.8);
  return true;
}

applyEffectsMode();
installFeedbackControls();
document.addEventListener("pointerdown", () => getAudioContext(), { passive: true, once: true });
window.addEventListener("resize", resizeCanvas, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearAnimation();
});

export const cascadePresentationDirector = Object.freeze({
  transitionStart,
  transitionClear,
  transitionAfterFall,
  transitionLand,
  invalidSwap,
  hammer,
  presentLevelComplete,
  presentBlitzComplete,
  failure,
  reset,
  getStats() {
    return {
      ...metrics,
      activeParticles: particles.length,
      activeWaves: waves.length,
      particleBudget: particleBudget(),
      canvasCount: document.querySelectorAll(".cascade-dopamine-canvas").length,
    };
  },
  demo,
  demoWin(options = {}) {
    const scoreBeforeBonus = Number(document.querySelector("#score")?.textContent?.replaceAll(",", "")) || 0;
    return presentLevelComplete({ moves: 3, scoreBeforeBonus, scoreAfterBonus: scoreBeforeBonus + 300, stars: 3, reward: { claimed: 1 }, ...options });
  },
});

window.cascadePresentationDirector = cascadePresentationDirector;
window.cascadeDopamineVfx = Object.freeze({
  getStats: cascadePresentationDirector.getStats,
  demo: cascadePresentationDirector.demo,
});
