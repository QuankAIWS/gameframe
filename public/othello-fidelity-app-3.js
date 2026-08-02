function drawDisc(ctx, centerX, centerY, radius, player, row, column, time, scaleX = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(centerX, centerY);
  ctx.scale(Math.max(.045, scaleX), 1);
  if (theme === "obsidian") drawObsidianDisc(ctx, radius, player, row, column);
  if (theme === "neon") drawNeonDisc(ctx, radius, player, row, column, time);
  if (theme === "garden") drawGardenDisc(ctx, radius, player, row, column, time);
  ctx.restore();
}

function drawObsidianDisc(ctx, radius, player, row, column) {
  ctx.shadowColor = "rgba(0,0,0,.68)";
  ctx.shadowBlur = 13;
  ctx.shadowOffsetY = 8;
  const gradient = ctx.createRadialGradient(-radius * .33, -radius * .42, radius * .08, 0, 0, radius);
  if (player === DARK) {
    gradient.addColorStop(0, "#8a8b88");
    gradient.addColorStop(.18, "#3b3d40");
    gradient.addColorStop(.58, "#111316");
    gradient.addColorStop(1, "#020305");
  } else {
    gradient.addColorStop(0, "#fffdf5");
    gradient.addColorStop(.33, "#ede3ce");
    gradient.addColorStop(.72, "#b8a98d");
    gradient.addColorStop(1, "#756957");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = player === DARK ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.56)";
  ctx.lineWidth = 2.1;
  ctx.stroke();
  ctx.strokeStyle = player === DARK ? "rgba(196,203,201,.1)" : "rgba(105,88,64,.18)";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    const bend = (hash(row, column, i) - .5) * radius;
    ctx.moveTo(-radius * .66, -radius * .25 + i * radius * .22);
    ctx.bezierCurveTo(-radius * .2, bend, radius * .15, -bend * .4, radius * .72, radius * (.08 + i * .08));
    ctx.stroke();
  }
}

function drawNeonDisc(ctx, radius, player, row, column, time) {
  const color = player === DARK ? "#ff4fd8" : "#67f3ff";
  const core = player === DARK ? "#33102f" : "#0a3742";
  const pulse = .72 + .28 * Math.sin(time * .003 + row + column * .7);
  ctx.shadowColor = color;
  ctx.shadowBlur = 22 + pulse * 10;
  const gradient = ctx.createRadialGradient(-radius * .25, -radius * .3, 2, 0, 0, radius);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(.055, "#eaffff");
  gradient.addColorStop(.11, color);
  gradient.addColorStop(.31, core);
  gradient.addColorStop(.7, "#06101c");
  gradient.addColorStop(.9, core);
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.1;
  ctx.stroke();
  ctx.globalAlpha = .48;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(-radius * .08, -radius * .08, radius * .72, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.rotate(time * .00018 * (player === DARK ? 1 : -1) + row * .1 + column * .07);
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.arc(0, 0, radius * .69, -.82, .82); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius * .69, Math.PI - .82, Math.PI + .82); ctx.stroke();
  ctx.shadowColor = "transparent";
}

function drawGardenDisc(ctx, radius, player, row, column, time) {
  ctx.shadowColor = "rgba(0,0,0,.4)";
  ctx.shadowBlur = 11;
  ctx.shadowOffsetY = 6;
  const base = ctx.createRadialGradient(-radius * .25, -radius * .3, 2, 0, 0, radius);
  if (player === DARK) {
    base.addColorStop(0, "#6a6e69");
    base.addColorStop(.22, "#353b37");
    base.addColorStop(.72, "#171b19");
    base.addColorStop(1, "#080a09");
  } else {
    base.addColorStop(0, "#fffdf9");
    base.addColorStop(.3, "#f2e4dc");
    base.addColorStop(.7, "#d6b8b2");
    base.addColorStop(1, "#8f716c");
  }
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.save();
  ctx.rotate(hash(row, column) * Math.PI + Math.sin(time * .00035 + row) * .018);
  if (player === DARK) drawLeafMark(ctx, radius);
  else drawLotusMark(ctx, radius);
  ctx.restore();

  ctx.strokeStyle = player === DARK ? "rgba(214,199,155,.3)" : "rgba(255,255,255,.48)";
  ctx.lineWidth = 1.65;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
}

function drawLeafMark(ctx, radius) {
  ctx.strokeStyle = "rgba(181,188,166,.47)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, radius * .48);
  ctx.quadraticCurveTo(-radius * .02, 0, 0, -radius * .47);
  ctx.stroke();
  for (const direction of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const y = radius * (.28 - i * .22);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(direction * radius * .34, y - radius * .12, direction * radius * .37, y - radius * .3);
      ctx.quadraticCurveTo(direction * radius * .08, y - radius * .25, 0, y);
      ctx.stroke();
    }
  }
}

function drawLotusMark(ctx, radius) {
  ctx.save();
  ctx.fillStyle = "rgba(255,249,243,.42)";
  ctx.strokeStyle = "rgba(151,103,98,.48)";
  ctx.lineWidth = 1.05;
  const petals = [
    { x: 0, y: -radius * .14, rx: radius * .16, ry: radius * .42, rotation: 0 },
    { x: -radius * .12, y: -radius * .08, rx: radius * .15, ry: radius * .36, rotation: -.42 },
    { x: radius * .12, y: -radius * .08, rx: radius * .15, ry: radius * .36, rotation: .42 },
    { x: -radius * .22, y: radius * .04, rx: radius * .13, ry: radius * .29, rotation: -.75 },
    { x: radius * .22, y: radius * .04, rx: radius * .13, ry: radius * .29, rotation: .75 },
  ];
  for (const petal of petals) {
    ctx.beginPath();
    ctx.ellipse(petal.x, petal.y, petal.rx, petal.ry, petal.rotation, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(157,113,103,.42)";
  ctx.beginPath();
  ctx.moveTo(-radius * .42, radius * .22);
  ctx.quadraticCurveTo(0, radius * .42, radius * .42, radius * .22);
  ctx.stroke();
  ctx.fillStyle = "rgba(221,181,139,.82)";
  ctx.beginPath(); ctx.arc(0, radius * .18, radius * .095, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
