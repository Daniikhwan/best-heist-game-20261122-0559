// render.js — everything the eye sees. The museum at night: dark marble,
// warm lamplight, shadow you can hide in, gold that glows, and cones of
// light that sweep the floor. Cones are raycast so they stop at walls and
// pool around cover — a cone that painted through a wall would lie.

import { TILE, COLS, ROWS, VIEW_W, VIEW_H, PALETTE } from './config.js';
import { isSolidTile, tileAt, angleTo } from './level.js';
import { GUARD_RANGE, GUARD_HALF_ANGLE } from './guards.js';
import { CAMERA_HALF_ANGLE } from './cameras.js';
import { mulberry32 } from './random.js';
import { allLootTaken } from './loot.js';

const LAMPS = [
  { x: 320, y: 170, r: 230 },
  { x: 960, y: 170, r: 230 },
  { x: 320, y: 550, r: 230 },
  { x: 960, y: 550, r: 230 },
];

let backgroundCache = null;
let backgroundKey = '';

function buildBackground(level) {
  const key = level.def.name;
  if (backgroundCache && backgroundKey === key) return backgroundCache;
  const off = document.createElement('canvas');
  off.width = VIEW_W;
  off.height = VIEW_H;
  const g = off.getContext('2d');
  const rng = mulberry32(1337 + level.def.name.length * 97);

  // Marble floor: two dark tones in a checker, faint veins, grout lines.
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = tileAt(level, tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') continue;
      g.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      g.fillRect(x, y, TILE, TILE);
      if (ch === ',') {
        g.fillStyle = 'rgba(8, 12, 32, 0.55)';
        g.fillRect(x, y, TILE, TILE);
      }
      if (ch === 'X') {
        g.fillStyle = 'rgba(0, 0, 0, 0.35)';
        g.fillRect(x, y, TILE, TILE);
        g.strokeStyle = 'rgba(160, 170, 200, 0.35)';
        g.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(x + 8, y + 20 + i * 8);
          g.lineTo(x + 32, y + 20 + i * 8);
          g.stroke();
        }
      }
      g.strokeStyle = PALETTE.marbleLine;
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if (rng() < 0.16) {
        g.strokeStyle = 'rgba(120, 130, 180, 0.10)';
        g.beginPath();
        g.moveTo(x + rng() * TILE, y);
        g.lineTo(x + rng() * TILE, y + TILE);
        g.stroke();
      }
    }
  }

  // Walls: dark slate with a gold trim facing the room.
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (tileAt(level, tx, ty) !== '#') continue;
      const x = tx * TILE;
      const y = ty * TILE;
      g.fillStyle = PALETTE.wall;
      g.fillRect(x, y, TILE, TILE);
      g.fillStyle = 'rgba(255, 255, 255, 0.05)';
      g.fillRect(x, y, TILE, 5);
      // One gold edge where the wall meets the floor below it: the wall
      // reads as architecture from above, never as a yellow box.
      const below = tileAt(level, tx, ty + 1);
      if (below !== '#') {
        g.fillStyle = PALETTE.wallTrim;
        g.fillRect(x, y + TILE - 3, TILE, 3);
      }
    }
  }

  // Pedestals and crates: solid cover the thief hides behind.
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = tileAt(level, tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === 'D') {
        g.fillStyle = '#2c3350';
        g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        g.fillStyle = '#3d466c';
        g.fillRect(x + 4, y + 4, TILE - 8, 8);
        g.fillStyle = PALETTE.wallTrim;
        g.fillRect(x + 4, y + 4, TILE - 8, 2);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.strokeRect(x + 4.5, y + 4.5, TILE - 9, TILE - 9);
      }
      if (ch === 'T') {
        g.fillStyle = '#4a3b26';
        g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        g.strokeStyle = '#2e2415';
        g.lineWidth = 2;
        g.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
        g.beginPath();
        g.moveTo(x + 3, y + 3);
        g.lineTo(x + TILE - 3, y + TILE - 3);
        g.moveTo(x + TILE - 3, y + 3);
        g.lineTo(x + 3, y + TILE - 3);
        g.stroke();
      }
    }
  }

  backgroundCache = off;
  backgroundKey = key;
  return off;
}

// March one ray until it hits a solid tile or runs out of range.
function castRay(level, x, y, angle, range) {
  const step = 7;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let d = 0;
  while (d < range) {
    d += step;
    const px = x + dx * d;
    const py = y + dy * d;
    if (isSolidTile(level, Math.floor(px / TILE), Math.floor(py / TILE))) return { x: px - dx * step * 0.5, y: py - dy * step * 0.5 };
  }
  return { x: x + dx * range, y: y + dy * range };
}

function conePolygon(level, x, y, angle, halfAngle, range) {
  const rays = 26;
  const points = [{ x, y }];
  for (let i = 0; i <= rays; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    points.push(castRay(level, x, y, a, range));
  }
  return points;
}

function drawCone(ctx, level, x, y, angle, halfAngle, range, fill, edge) {
  const points = conePolygon(level, x, y, angle, halfAngle, range);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  // The cone stays readable halfway out and only fades at its far edge.
  const grad = ctx.createRadialGradient(x, y, 8, x, y, range);
  grad.addColorStop(0, fill);
  grad.addColorStop(0.55, fill);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.moveTo(x, y);
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

function drawLightPools(ctx, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const lamp of LAMPS) {
    const flicker = 1 + Math.sin(time * 1.7 + lamp.x) * 0.05;
    const grad = ctx.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, lamp.r * flicker);
    grad.addColorStop(0, 'rgba(255, 190, 90, 0.10)');
    grad.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r * flicker, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLoot(ctx, state, time) {
  for (const item of state.level.loot) {
    if (item.taken) continue;
    const twinkle = 0.75 + Math.sin(time * 3 + item.phase) * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(item.x, item.y, 4, item.x, item.y, 56);
    const color = item.kind === 'vault' ? '255, 211, 77' : '77, 216, 255';
    glow.addColorStop(0, `rgba(${color}, ${0.35 * twinkle})`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A little plinth, then the prize itself.
    ctx.fillStyle = '#2c3350';
    ctx.fillRect(item.x - 13, item.y + 8, 26, 8);
    if (item.kind === 'vault') {
      ctx.fillStyle = PALETTE.lootGold;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 16);
      ctx.lineTo(item.x + 13, item.y - 2);
      ctx.lineTo(item.x + 8, item.y + 12);
      ctx.lineTo(item.x - 8, item.y + 12);
      ctx.lineTo(item.x - 13, item.y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 10);
      ctx.lineTo(item.x + 6, item.y - 1);
      ctx.lineTo(item.x - 6, item.y - 1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.lootGem;
      ctx.save();
      ctx.translate(item.x, item.y - 2);
      ctx.rotate(Math.PI / 4 + Math.sin(time * 2 + item.phase) * 0.12);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-8, -8, 16, 5);
      ctx.restore();
    }
    // Sparkles.
    for (let s = 0; s < 3; s++) {
      const a = time * 1.4 + item.phase + s * 2.1;
      const sx = item.x + Math.cos(a) * 20;
      const sy = item.y - 6 + Math.sin(a * 1.3) * 12;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * Math.sin(time * 4 + s)})`;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }
  for (const coin of state.level.coins) {
    if (coin.taken) continue;
    const bob = Math.sin(time * 3 + coin.phase) * 2;
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + bob, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(coin.x - 1.5, coin.y + bob - 1.5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLasers(ctx, state, time) {
  for (const laser of state.level.lasers) {
    const x = (laser.tx + 0.5) * TILE;
    const top = laser.top * TILE;
    const bottom = (laser.bottom + 1) * TILE;
    if (laser.active) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
      grad.addColorStop(0, 'rgba(255, 40, 40, 0)');
      grad.addColorStop(0.5, 'rgba(255, 40, 40, 0.35)');
      grad.addColorStop(1, 'rgba(255, 40, 40, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 10, top, 20, bottom - top);
      ctx.restore();
      ctx.strokeStyle = '#ff2e2e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.fillStyle = '#ff6b6b';
      for (let y = top + 8; y < bottom; y += 26) {
        ctx.beginPath();
        ctx.arc(x, y + Math.sin(time * 6 + y) * 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.25)';
      ctx.setLineDash([4, 10]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Emitters on the walls at both ends.
    ctx.fillStyle = '#3a415c';
    ctx.fillRect(x - 8, top - 4, 16, 8);
    ctx.fillRect(x - 8, bottom - 4, 16, 8);
    ctx.fillStyle = laser.active ? '#ff2e2e' : '#5a2e2e';
    ctx.beginPath();
    ctx.arc(x, top, 3, 0, Math.PI * 2);
    ctx.arc(x, bottom, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, state, time) {
  const exit = state.level.exit;
  const open = allLootTaken(state);
  const pulse = open ? 0.7 + Math.sin(time * 4) * 0.3 : 0.25;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(exit.x, exit.y, 6, exit.x, exit.y, 70);
  const color = open ? '125, 255, 158' : '255, 80, 80';
  grad.addColorStop(0, `rgba(${color}, ${0.4 * pulse})`);
  grad.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(exit.x, exit.y, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = open ? '#1f7a37' : '#5a1f1f';
  ctx.fillRect(exit.x - 17, exit.y - 17, 34, 34);
  ctx.strokeStyle = open ? PALETTE.safe : '#ff6b6b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(exit.x - 17, exit.y - 17, 34, 34);
  ctx.fillStyle = open ? PALETTE.safe : '#ff8a8a';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'VAN' : 'LOCK', exit.x, exit.y + 4);
}

function drawGuards(ctx, state, time) {
  for (const guard of state.guards) {
    const alert = guard.suspicion > 55;
    drawCone(
      ctx, state.level, guard.x, guard.y, guard.angle, GUARD_HALF_ANGLE, GUARD_RANGE,
      alert ? 'rgba(255, 90, 60, 0.22)' : PALETTE.coneGuard,
      alert ? 'rgba(255, 90, 60, 0.6)' : PALETTE.coneGuardEdge,
    );
  }
  for (const guard of state.guards) {
    const bobY = Math.sin(guard.bob) * 1.5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(guard.x, guard.y + 13, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y + bobY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.guardTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y + bobY, 14, 0, Math.PI * 2);
    ctx.stroke();
    // Cap brim points where the guard looks.
    ctx.fillStyle = PALETTE.guardTrim;
    ctx.beginPath();
    ctx.arc(
      guard.x + Math.cos(guard.angle) * 10,
      guard.y + bobY + Math.sin(guard.angle) * 10,
      5, 0, Math.PI * 2,
    );
    ctx.fill();
    // Suspicion mark: ? while curious, ! once the chase is on.
    if (guard.mode === 'investigate' || guard.mode === 'search') {
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - 22 + bobY);
    }
    if (guard.mode === 'hunt' || guard.suspicion >= 100) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 22 + bobY);
    }
  }
}

function drawCameras(ctx, state, time) {
  for (const camera of state.cameras) {
    if (camera.disabled <= 0) {
      drawCone(
        ctx, state.level, camera.x, camera.y, camera.angle, CAMERA_HALF_ANGLE, camera.range,
        PALETTE.coneCamera, PALETTE.coneCameraEdge,
      );
    }
  }
  for (const camera of state.cameras) {
    const off = camera.disabled > 0;
    ctx.fillStyle = '#2a3049';
    ctx.fillRect(camera.x - 9, camera.y - 9, 18, 18);
    ctx.strokeStyle = '#4a5478';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(camera.x - 9, camera.y - 9, 18, 18);
    ctx.fillStyle = off ? '#555' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(
      camera.x + Math.cos(camera.angle) * 5,
      camera.y + Math.sin(camera.angle) * 5,
      off ? 3 : 3.5 + Math.sin(time * 6) * 1.2,
      0, Math.PI * 2,
    );
    ctx.fill();
    if (off) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFF', camera.x, camera.y - 13);
    }
  }
}

function drawThief(ctx, state, time) {
  const thief = state.thief;
  const scale = thief.sneaking ? 0.88 : 1;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(thief.x, thief.y + 13, 13, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(thief.x, thief.y + Math.sin(thief.bob) * 1.2);
  ctx.scale(scale, scale);
  // Cloak: a hooded figure, dark against the floor, edged in pale light.
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.thiefTrim;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.moveTo(Math.cos(thief.angle) * 16, Math.sin(thief.angle) * 16);
  ctx.lineTo(Math.cos(thief.angle + 2.5) * 10, Math.sin(thief.angle + 2.5) * 10);
  ctx.lineTo(Math.cos(thief.angle - 2.5) * 10, Math.sin(thief.angle - 2.5) * 10);
  ctx.closePath();
  ctx.fill();
  // The mask: two pale eyes in the dark.
  ctx.fillStyle = '#e8ecff';
  ctx.beginPath();
  ctx.arc(Math.cos(thief.angle) * 6 - Math.sin(thief.angle) * 4, Math.sin(thief.angle) * 6 + Math.cos(thief.angle) * 4, 2.2, 0, Math.PI * 2);
  ctx.arc(Math.cos(thief.angle) * 6 + Math.sin(thief.angle) * 4, Math.sin(thief.angle) * 6 - Math.cos(thief.angle) * 4, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (thief.sneaking) {
    ctx.fillStyle = 'rgba(232, 236, 255, 0.75)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('sneaking', thief.x, thief.y - 20);
  }
}

function drawSmokeAndCoin(ctx, state) {
  const thief = state.thief;
  for (const cloud of thief.smoke) {
    const alpha = Math.min(0.85, cloud.t / SMOKE_SECONDS + 0.3);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + cloud.t;
      const px = cloud.x + Math.cos(a) * cloud.r * 0.55;
      const py = cloud.y + Math.sin(a) * cloud.r * 0.55;
      ctx.fillStyle = `rgba(190, 195, 215, ${alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(px, py, cloud.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (thief.thrownCoin) {
    const coin = thief.thrownCoin;
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (coin.landed) {
      ctx.strokeStyle = `rgba(255, 211, 77, ${Math.max(0, 1 - coin.ring / 200)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(coin.tx, coin.ty, coin.ring, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawDust(ctx, state, time) {
  const rng = mulberry32(42);
  ctx.fillStyle = 'rgba(255, 220, 150, 0.25)';
  for (let i = 0; i < 40; i++) {
    const x = rng() * VIEW_W;
    const y = rng() * VIEW_H;
    const drift = Math.sin(time * 0.4 + i) * 6;
    ctx.fillRect(x + drift, y + Math.sin(time * 0.25 + i * 2) * 4, 1.6, 1.6);
  }
}

function drawHud(ctx, state) {
  const level = state.level;
  const thief = state.thief;
  ctx.save();
  // Top bar.
  ctx.fillStyle = 'rgba(6, 8, 18, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, 46);
  ctx.fillStyle = '#e8ecff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(level.def.name, 16, 19);
  ctx.fillStyle = 'rgba(232, 236, 255, 0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Time ${Math.floor(state.time)}s  ·  Score ${state.score}`, 16, 37);
  // Loot progress, top centre.
  const total = level.loot.length;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`LOOT  ${state.lootTaken}/${total}`, VIEW_W / 2, 19);
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < state.lootTaken ? '#ffd34d' : 'rgba(255, 211, 77, 0.25)';
    ctx.beginPath();
    ctx.arc(VIEW_W / 2 - ((total - 1) * 11) + i * 22, 34, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Alarm meter, top right.
  const ax = VIEW_W - 268;
  ctx.textAlign = 'left';
  ctx.fillStyle = state.alarm > 70 ? '#ff6b6b' : '#e8ecff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('ALARM', ax, 19);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(ax + 62, 8, 180, 14);
  const alarmGrad = ctx.createLinearGradient(ax + 62, 0, ax + 242, 0);
  alarmGrad.addColorStop(0, '#7dff9e');
  alarmGrad.addColorStop(0.55, '#ffd34d');
  alarmGrad.addColorStop(1, '#ff3b30');
  ctx.fillStyle = alarmGrad;
  ctx.fillRect(ax + 62, 8, 180 * (state.alarm / 100), 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ax + 62.5, 8.5, 180, 14);
  ctx.fillStyle = state.lockdown ? '#ff6b6b' : 'rgba(232,236,255,0.75)';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(state.lockdown ? 'LOCKDOWN!' : `${Math.floor(state.alarm)}%`, ax + 62, 38);

  // Bottom bar.
  ctx.fillStyle = 'rgba(6, 8, 18, 0.72)';
  ctx.fillRect(0, VIEW_H - 44, VIEW_W, 44);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`◉ ${thief.coins} coins`, 16, VIEW_H - 16);
  const tools = [
    { key: '1', name: 'Coin', cost: 1, have: thief.coins >= 1 },
    { key: '2', name: 'Smoke', cost: 2, have: thief.coins >= 2 },
    { key: '3', name: 'EMP', cost: 3, have: thief.coins >= 3 },
  ];
  let tx = 150;
  for (const tool of tools) {
    ctx.fillStyle = tool.have ? '#e8ecff' : 'rgba(232,236,255,0.35)';
    ctx.font = '12px sans-serif';
    ctx.fillText(`[${tool.key}] ${tool.name} (${tool.cost}c)`, tx, VIEW_H - 16);
    tx += 104;
  }
  if (thief.empTimer > 0) {
    ctx.fillStyle = '#4dd8ff';
    ctx.fillText(`EMP ${thief.empTimer.toFixed(0)}s`, tx + 8, VIEW_H - 16);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = allLootTaken(state) ? PALETTE.safe : '#ffd34d';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(
    allLootTaken(state) ? 'ALL LOOT TAKEN — GET TO THE VAN!' : 'Steal every relic, then reach the getaway door',
    VIEW_W / 2, VIEW_H - 16,
  );
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(232,236,255,0.55)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move · Shift sneak · Click: toss coin · M mute · P pause', VIEW_W - 16, VIEW_H - 16);
  ctx.restore();
}

function drawVignette(ctx, state, time) {
  const grad = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42,
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (state.alarm > 55) {
    const pulse = (state.alarm - 55) / 45 * (0.22 + Math.sin(time * 6) * 0.1);
    const red = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35,
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.8,
    );
    red.addColorStop(0, 'rgba(255,30,30,0)');
    red.addColorStop(1, `rgba(255,30,30,${pulse})`);
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(4, 6, 14, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function centerText(ctx, text, y, size, color, bold = true) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, y);
}

export function drawScene(ctx, state) {
  const time = state.time;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(buildBackground(state.level), 0, 0);
  drawLightPools(ctx, time);
  drawLoot(ctx, state, time);
  drawLasers(ctx, state, time);
  drawExit(ctx, state, time);
  drawGuards(ctx, state, time);
  drawCameras(ctx, state, time);
  drawThief(ctx, state, time);
  drawSmokeAndCoin(ctx, state);
  drawDust(ctx, state, time);
  drawVignette(ctx, state, time);
  drawHud(ctx, state);
}

export function drawTitle(ctx, state) {
  drawScene(ctx, state);
  dim(ctx, 0.62);
  centerText(ctx, 'THE MIDNIGHT VAULT', 250, 64, '#ffd34d');
  centerText(ctx, 'A stealth heist in three rooms', 292, 22, '#e8ecff', false);
  centerText(ctx, 'Slip past the guards. Read the cones. Take everything.', 340, 18, 'rgba(232,236,255,0.8)', false);
  centerText(ctx, 'Then get to the green van door.', 364, 18, 'rgba(232,236,255,0.8)', false);
  centerText(ctx, 'WASD / arrows — move      Shift — sneak', 430, 17, '#e8ecff', false);
  centerText(ctx, 'Click — toss a coin to distract a guard      2 — smoke      3 — EMP the cameras', 458, 17, '#e8ecff', false);
  centerText(ctx, 'Shadow and vents hide you. A full alarm brings every guard running.', 486, 17, '#e8ecff', false);
  centerText(ctx, '—  Click or press Enter to begin  —', 560, 22, '#ffd34d');
  if (state.bestScore > 0) {
    centerText(ctx, `Best score so far: ${state.bestScore}`, 600, 15, 'rgba(232,236,255,0.7)', false);
  }
}

export function drawPaused(ctx, state) {
  drawScene(ctx, state);
  dim(ctx, 0.55);
  centerText(ctx, 'PAUSED', 330, 52, '#e8ecff');
  centerText(ctx, 'Press P to keep sneaking', 380, 18, 'rgba(232,236,255,0.8)', false);
}

export function drawCaught(ctx, state) {
  drawScene(ctx, state);
  dim(ctx, 0.6);
  centerText(ctx, 'CAUGHT!', 300, 72, '#ff3b30');
  centerText(ctx, 'A guard got a hand on you.', 360, 20, '#e8ecff', false);
  centerText(ctx, `Room score lost: ${state.levelScore}  ·  Total score kept: ${state.totalScore}`, 396, 17, 'rgba(232,236,255,0.8)', false);
  centerText(ctx, 'Watch the cones. Break line of sight before the alarm fills.', 430, 17, 'rgba(232,236,255,0.8)', false);
  centerText(ctx, 'Press R to try this room again', 500, 20, '#ffd34d');
}

export function drawLevelClear(ctx, state) {
  drawScene(ctx, state);
  dim(ctx, 0.55);
  centerText(ctx, 'ROOM CLEARED', 260, 56, PALETTE.safe);
  centerText(ctx, state.level.def.name, 306, 20, '#e8ecff', false);
  const timeBonus = Math.max(0, Math.floor((state.level.def.parSeconds - state.levelTime) * 4));
  const ghost = state.maxAlarm < 60 ? 200 : 0;
  centerText(ctx, `Loot ${state.levelLootScore}  ·  Time bonus ${timeBonus}  ·  Ghost bonus ${ghost}`, 360, 18, '#e8ecff', false);
  centerText(ctx, `Room score: ${state.levelScore}      Total: ${state.totalScore}`, 396, 20, '#ffd34d');
  centerText(ctx, 'Press Enter for the next room', 470, 20, '#e8ecff');
}

export function drawWin(ctx, state) {
  drawScene(ctx, state);
  dim(ctx, 0.6);
  centerText(ctx, 'THE VAULT IS YOURS', 260, 58, '#ffd34d');
  centerText(ctx, 'Three rooms. Every relic. The van is already moving.', 312, 20, '#e8ecff', false);
  centerText(ctx, `Final score: ${state.totalScore}`, 370, 26, '#e8ecff');
  if (state.maxAlarm < 60) {
    centerText(ctx, 'Ghost run — the alarm never passed 60. Flawless.', 410, 18, PALETTE.safe, false);
  }
  centerText(ctx, 'Press Enter to run it again', 480, 20, '#ffd34d');
}
