function drawNeonBackground(ctx, time) {
  const gradient = ctx.createRadialGradient(470, 420, 90, 480, 480, 720);
  gradient.addColorStop(0, "#0c2a43");
  gradient.addColorStop(.5, "#061426");
  gradient.addColorStop(1, "#01050c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 960);

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(77,225,255,.055)";
  for (let x = 18; x < 960; x += 84) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 960); ctx.stroke();
  }
  for (let y = 18; y < 960; y += 84) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,62,207,.18)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 118); ctx.lineTo(122, 118); ctx.lineTo(174, 66); ctx.lineTo(318, 66);
  ctx.stroke();
  ctx.strokeStyle = "rgba(82,231,255,.18)";
  ctx.beginPath();
  ctx.moveTo(960, 118); ctx.lineTo(838, 118); ctx.lineTo(786, 66); ctx.lineTo(642, 66);
  ctx.stroke();

  const sweep = (time * .14) % 1180 - 120;
  const sweepGradient = ctx.createLinearGradient(0, sweep - 70, 0, sweep + 70);
  sweepGradient.addColorStop(0, "rgba(80,231,255,0)");
  sweepGradient.addColorStop(.5, "rgba(80,231,255,.12)");
  sweepGradient.addColorStop(1, "rgba(80,231,255,0)");
  ctx.fillStyle = sweepGradient;
  ctx.fillRect(0, sweep - 70, 960, 140);

  ctx.strokeStyle = "rgba(255,62,207,.18)";
  ctx.beginPath();
  ctx.moveTo(0, 160); ctx.lineTo(160, 160); ctx.lineTo(220, 100); ctx.lineTo(360, 100);
  ctx.stroke();
  ctx.strokeStyle = "rgba(80,231,255,.18)";
  ctx.beginPath();
  ctx.moveTo(960, 800); ctx.lineTo(820, 800); ctx.lineTo(760, 860); ctx.lineTo(620, 860);
  ctx.stroke();

  for (let i = 0; i < 22; i += 1) {
    const x = 24 + hash(i, 21) * 912;
    const y = 24 + hash(i, 22) * 912;
    ctx.fillStyle = i % 2 ? "rgba(82,231,255,.18)" : "rgba(255,62,207,.13)";
    ctx.beginPath(); ctx.arc(x, y, 1.2 + hash(i, 23) * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawGardenBackground(ctx, time) {
  const gradient = ctx.createRadialGradient(690, 210, 70, 480, 480, 760);
  gradient.addColorStop(0, "#566b56");
  gradient.addColorStop(.42, "#263f31");
  gradient.addColorStop(1, "#09150f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 960);

  ctx.save();
  ctx.strokeStyle = "rgba(210,187,123,.07)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i += 1) {
    const x = 80 + hash(i, 3) * 800;
    const y = 80 + hash(i, 4) * 800;
    const radius = 30 + hash(i, 5) * 74 + Math.sin(time * .0005 + i) * 2;
    ctx.beginPath(); ctx.ellipse(x, y, radius * 1.3, radius, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 34; i += 1) {
    const x = hash(i, 1) * 960;
    const y = (hash(i, 2) * 960 + time * (2.4 + hash(i, 4) * 3.5) * .01) % 1030 - 35;
    const size = 1 + hash(i, 3) * 2.5;
    ctx.fillStyle = `rgba(234,207,145,${.06 + hash(i, 7) * .14})`;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "rgba(220,231,202,.035)";
  for (let i = 0; i < 9; i += 1) {
    const y = 120 + i * 92 + Math.sin(time * .00022 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(45, y);
    ctx.bezierCurveTo(260, y - 9, 700, y + 12, 915, y - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function frameGradient(ctx, margin, boardSize) {
  const gradient = ctx.createLinearGradient(margin - 30, margin - 30, margin + boardSize + 30, margin + boardSize + 30);
  if (theme === "obsidian") {
    gradient.addColorStop(0, "#b79a62");
    gradient.addColorStop(.08, "#433622");
    gradient.addColorStop(.42, "#151412");
    gradient.addColorStop(.82, "#2e2519");
    gradient.addColorStop(1, "#8f7448");
  } else if (theme === "neon") {
    gradient.addColorStop(0, "#ff4bd3");
    gradient.addColorStop(.08, "#173d56");
    gradient.addColorStop(.48, "#061629");
    gradient.addColorStop(.92, "#12445c");
    gradient.addColorStop(1, "#61efff");
  } else {
    gradient.addColorStop(0, "#78906a");
    gradient.addColorStop(.13, "#385238");
    gradient.addColorStop(.5, "#1a3123");
    gradient.addColorStop(.86, "#31482f");
    gradient.addColorStop(1, "#b49b5f");
  }
  return gradient;
}

function drawBoardFoundation(ctx, time) {
  const { margin, boardSize, cell } = boardMetrics();
  ctx.save();
  if (theme === "obsidian") drawObsidianBackground(ctx, time);
  if (theme === "neon") drawNeonBackground(ctx, time);
  if (theme === "garden") drawGardenBackground(ctx, time);

  ctx.shadowColor = theme === "neon" ? "rgba(58,221,255,.38)" : "rgba(0,0,0,.66)";
  ctx.shadowBlur = theme === "neon" ? 42 : 30;
  ctx.shadowOffsetY = 16;
  roundedRect(ctx, margin - 28, margin - 28, boardSize + 56, boardSize + 56, theme === "garden" ? 42 : 32);
  ctx.fillStyle = frameGradient(ctx, margin, boardSize);
  ctx.fill();
  ctx.shadowColor = "transparent";

  roundedRect(ctx, margin - 18, margin - 18, boardSize + 36, boardSize + 36, theme === "garden" ? 34 : 24);
  ctx.fillStyle = theme === "neon" ? "#031020" : theme === "garden" ? "#1b3225" : "#0c0e0e";
  ctx.fill();
  ctx.strokeStyle = theme === "neon" ? "rgba(100,239,255,.55)" : "rgba(205,169,101,.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (theme === "garden") drawMossSpeckle(ctx, margin, boardSize);

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      drawCell(ctx, margin + column * cell, margin + row * cell, cell, row, column, time);
    }
  }

  ctx.restore();
}

function drawMossSpeckle(ctx, margin, boardSize) {
  for (let i = 0; i < 95; i += 1) {
    const angle = hash(i, 2) * Math.PI * 2;
    const edge = hash(i, 4) > .5;
    const x = edge
      ? margin - 18 + hash(i, 5) * (boardSize + 36)
      : hash(i, 6) > .5 ? margin - 14 : margin + boardSize + 14;
    const y = edge
      ? hash(i, 7) > .5 ? margin - 14 : margin + boardSize + 14
      : margin - 18 + hash(i, 8) * (boardSize + 36);
    ctx.fillStyle = `rgba(${90 + Math.floor(hash(i, 9) * 55)},${105 + Math.floor(hash(i, 10) * 55)},${55 + Math.floor(hash(i, 11) * 40)},${.08 + hash(i, 12) * .16})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + hash(i, 13) * 2.4, .8 + hash(i, 14) * 1.8, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCell(ctx, x, y, size, row, column, time) {
  const inset = theme === "garden" ? 5 : theme === "neon" ? 3 : 2;
  const radius = theme === "garden" ? 16 : theme === "neon" ? 7 : 7;
  roundedRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, radius);
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);

  if (theme === "obsidian") {
    const alternate = (row + column) % 2;
    gradient.addColorStop(0, alternate ? "#283832" : "#30433b");
    gradient.addColorStop(.55, alternate ? "#16231f" : "#1b2b25");
    gradient.addColorStop(1, "#0a1210");
  } else if (theme === "neon") {
    gradient.addColorStop(0, "rgba(14,48,68,.98)");
    gradient.addColorStop(.42, "rgba(5,24,43,.99)");
    gradient.addColorStop(1, "rgba(2,9,20,1)");
  } else {
    const tone = hash(row, column);
    gradient.addColorStop(0, tone > .5 ? "#60745d" : "#566d56");
    gradient.addColorStop(.42, tone > .5 ? "#465d49" : "#3f5743");
    gradient.addColorStop(1, "#2b4032");
  }
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = theme === "neon"
    ? "rgba(77,224,255,.42)"
    : theme === "garden"
      ? "rgba(223,202,145,.24)"
      : "rgba(210,178,111,.28)";
  ctx.lineWidth = theme === "neon" ? 2.15 : 1.15;
  ctx.stroke();

  if (theme === "garden") {
    ctx.save();
    roundedRect(ctx, x + inset + 2, y + inset + 2, size - (inset + 2) * 2, size - (inset + 2) * 2, radius - 2);
    const sheen = ctx.createLinearGradient(x, y, x, y + size);
    sheen.addColorStop(0, "rgba(255,255,240,.095)");
    sheen.addColorStop(.28, "rgba(255,255,240,.024)");
    sheen.addColorStop(1, "rgba(1,13,8,.16)");
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.strokeStyle = "rgba(13,32,22,.38)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(238,220,169,.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + size * .5, y + 14);
    ctx.quadraticCurveTo(x + size * (.35 + hash(row, column) * .3), y + size * .5, x + size * .5, y + size - 14);
    ctx.stroke();
    for (let i = 0; i < 7; i += 1) {
      const px = x + 14 + hash(row, column, 20 + i) * (size - 28);
      const py = y + 14 + hash(row, column, 40 + i) * (size - 28);
      ctx.fillStyle = `rgba(235,222,180,${.014 + hash(row, column, 60 + i) * .032})`;
      ctx.beginPath(); ctx.arc(px, py, .55 + hash(row, column, 80 + i) * 1.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = .12;
    ctx.strokeStyle = "rgba(237,224,181,.4)";
    ctx.lineWidth = .65;
    for (let i = 0; i < 4; i += 1) {
      const offset = 18 + i * 18 + hash(row, column, 110 + i) * 9;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + offset);
      ctx.lineTo(x + size - 12, y + offset - 8 - hash(row, column, 130 + i) * 7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  if (theme === "obsidian") {
    ctx.strokeStyle = "rgba(255,255,255,.038)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 13, y + size * (.22 + hash(row, column, 3) * .3));
    ctx.bezierCurveTo(x + size * .34, y + size * .15, x + size * .67, y + size * .72, x + size - 12, y + size * (.45 + hash(row, column, 4) * .24));
    ctx.stroke();
  }

  if (theme === "neon") {
    const pulse = .45 + .55 * Math.sin(time * .002 + row * 1.3 + column * .7);
    ctx.save();
    ctx.shadowColor = "rgba(81,229,255,.5)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "rgba(88,232,255,.42)";
    ctx.globalAlpha = .2 + pulse * .18;
    ctx.fillRect(x + 8, y + 8, 4, 4);
    ctx.fillRect(x + size - 12, y + size - 12, 4, 4);
    ctx.globalAlpha = .25;
    ctx.strokeStyle = "rgba(91,232,255,.58)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8.5, y + 8.5, size - 17, size - 17);
    const edge = ctx.createLinearGradient(x + 8, y + 8, x + size - 8, y + size - 8);
    edge.addColorStop(0, "rgba(117,245,255,.23)");
    edge.addColorStop(.48, "rgba(73,225,255,.015)");
    edge.addColorStop(1, "rgba(255,60,207,.11)");
    ctx.strokeStyle = edge;
    ctx.globalAlpha = .7;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + size - 11);
    ctx.lineTo(x + 12, y + 12);
    ctx.lineTo(x + size - 11, y + 12);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

