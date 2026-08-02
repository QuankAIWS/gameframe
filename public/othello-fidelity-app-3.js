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
  const core = player === DARK ? "#280b25" : "#082f39";
  const pulse = .72 + .28 * Math.sin(time * .003 + row + column * .7);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 26 + pulse * 10;
  ctx.globalAlpha = .25;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, radius * 1.11, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = .28;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, 0, radius * 1.18, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;

  const gradient = ctx.createRadialGradient(-radius * .29, -radius * .36, radius * .035, 0, 0, radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(.05, "#eaffff");
  gradient.addColorStop(.105, color);
  gradient.addColorStop(.27, player === DARK ? "#8f1978" : "#116f82");
  gradient.addColorStop(.47, core);
  gradient.addColorStop(.75, "#040a12");
  gradient.addColorStop(.9, core);
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();

  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  ctx.globalAlpha = .62;
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(-radius * .06, -radius * .09, radius * .72, Math.PI * 1.07, Math.PI * 1.52); ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.rotate(time * .00017 * (player === DARK ? 1 : -1) + row * .1 + column * .07);
  ctx.strokeStyle = `${color}b8`;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, radius * .69, -.88, .82); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius * .69, Math.PI - .88, Math.PI + .82); ctx.stroke();

  ctx.globalAlpha = .32;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = .8;
  ctx.beginPath(); ctx.arc(0, 0, radius * .84, .35, 1.42); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawGardenDisc(ctx, radius, player, row, column, time) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.48)";
  ctx.shadowBlur = 13;
  ctx.shadowOffsetY = 7;

  const base = ctx.createRadialGradient(-radius * .3, -radius * .36, radius * .035, 0, 0, radius);
  if (player === DARK) {
    base.addColorStop(0, "#8d9189");
    base.addColorStop(.13, "#4a504b");
    base.addColorStop(.46, "#242a26");
    base.addColorStop(.79, "#101310");
    base.addColorStop(1, "#050706");
  } else {
    base.addColorStop(0, "#fffdf8");
    base.addColorStop(.18, "#f7e9e2");
    base.addColorStop(.5, "#e5c9c1");
    base.addColorStop(.82, "#bd9591");
    base.addColorStop(1, "#735853");
  }
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent";

  const rim = ctx.createLinearGradient(-radius, -radius, radius, radius);
  rim.addColorStop(0, player === DARK ? "rgba(241,232,201,.34)" : "rgba(255,255,255,.78)");
  rim.addColorStop(.5, player === DARK ? "rgba(190,166,111,.15)" : "rgba(190,133,126,.2)");
  rim.addColorStop(1, player === DARK ? "rgba(29,21,12,.6)" : "rgba(91,60,53,.48)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(0, 0, radius - 1.2, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = player === DARK ? "rgba(214,199,155,.22)" : "rgba(255,255,255,.42)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, radius * .84, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = player === DARK ? "rgba(201,181,119,.12)" : "rgba(176,120,111,.16)";
  ctx.lineWidth = .8;
  ctx.beginPath(); ctx.arc(0, 0, radius * .72, 0, Math.PI * 2); ctx.stroke();

  ctx.save();
  ctx.rotate(hash(row, column) * .35 + Math.sin(time * .00035 + row) * .012);
  if (player === DARK) drawLeafMark(ctx, radius);
  else drawLotusMark(ctx, radius);
  ctx.restore();

  ctx.globalAlpha = player === DARK ? .24 : .32;
  const shine = ctx.createRadialGradient(-radius * .34, -radius * .42, 0, -radius * .34, -radius * .42, radius * .46);
  shine.addColorStop(0, "rgba(255,255,255,.95)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath(); ctx.arc(0, 0, radius * .92, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawLeafMark(ctx, radius) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.strokeStyle = "rgba(201,204,188,.5)";
  ctx.fillStyle = "rgba(176,184,163,.055)";
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.moveTo(0, radius * .5);
  ctx.quadraticCurveTo(-radius * .03, 0, 0, -radius * .49);
  ctx.stroke();
  for (const direction of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const y = radius * (.29 - i * .22);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(direction * radius * .34, y - radius * .11, direction * radius * .39, y - radius * .31);
      ctx.quadraticCurveTo(direction * radius * .11, y - radius * .27, 0, y);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = .38;
  ctx.strokeStyle = "rgba(255,245,213,.42)";
  ctx.lineWidth = .8;
  ctx.translate(-.8, -.8);
  ctx.beginPath();
  ctx.moveTo(0, radius * .48);
  ctx.quadraticCurveTo(-radius * .02, 0, 0, -radius * .47);
  ctx.stroke();
  ctx.restore();
}

function drawLotusMark(ctx, radius) {
  ctx.save();
  ctx.shadowColor = "rgba(95,54,51,.28)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = "rgba(255,250,244,.48)";
  ctx.strokeStyle = "rgba(155,103,98,.5)";
  ctx.lineWidth = .95;
  const petals = [
    { x: 0, y: -radius * .15, rx: radius * .16, ry: radius * .43, rotation: 0 },
    { x: -radius * .13, y: -radius * .08, rx: radius * .15, ry: radius * .37, rotation: -.42 },
    { x: radius * .13, y: -radius * .08, rx: radius * .15, ry: radius * .37, rotation: .42 },
    { x: -radius * .24, y: radius * .04, rx: radius * .14, ry: radius * .31, rotation: -.76 },
    { x: radius * .24, y: radius * .04, rx: radius * .14, ry: radius * .31, rotation: .76 },
    { x: -radius * .1, y: radius * .09, rx: radius * .12, ry: radius * .27, rotation: -.23 },
    { x: radius * .1, y: radius * .09, rx: radius * .12, ry: radius * .27, rotation: .23 },
  ];
  for (const petal of petals) {
    ctx.beginPath();
    ctx.ellipse(petal.x, petal.y, petal.rx, petal.ry, petal.rotation, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(159,109,102,.42)";
  ctx.beginPath();
  ctx.moveTo(-radius * .45, radius * .24);
  ctx.quadraticCurveTo(0, radius * .43, radius * .45, radius * .24);
  ctx.stroke();
  ctx.fillStyle = "rgba(218,178,128,.9)";
  ctx.beginPath(); ctx.arc(0, radius * .19, radius * .09, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = .4;
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = .7;
  ctx.beginPath(); ctx.ellipse(-radius * .04, -radius * .2, radius * .08, radius * .22, -.05, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

