// level.js — turns a level's text map into a room: walls, cover, shadow,
// vents, lasers, loot, coins, the thief's start and the getaway door.
// Also answers the two questions the stealth needs everywhere: can a body
// stand here, and can one point see another without a wall in between?

import { TILE, COLS, ROWS } from './config.js';

export const SOLID = new Set(['#', 'D', 'T']);
export const SHADOW = ',';
export const VENT = 'X';
export const LASER = '|';

export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  const level = {
    def,
    grid,
    loot: [],
    coins: [],
    lasers: [],
    start: { x: 1.5 * TILE, y: 1.5 * TILE },
    exit: { x: 1.5 * TILE, y: 1.5 * TILE },
    exitTile: { tx: 1, ty: 1 },
  };
  // The vault is one loot item however many V tiles it covers: flood-fill
  // the connected V tiles into a single prize at their centre.
  const seenVault = new Set();
  const floodVault = (sx, sy) => {
    const stack = [[sx, sy]];
    const tiles = [];
    while (stack.length) {
      const [tx, ty] = stack.pop();
      const key = tx + ',' + ty;
      if (seenVault.has(key)) continue;
      if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) continue;
      if (grid[ty][tx] !== 'V') continue;
      seenVault.add(key);
      tiles.push([tx, ty]);
      stack.push([tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]);
    }
    return tiles;
  };
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = grid[ty][tx];
      const cx = (tx + 0.5) * TILE;
      const cy = (ty + 0.5) * TILE;
      if (ch === 'P') level.start = { x: cx, y: cy };
      if (ch === 'E') {
        level.exit = { x: cx, y: cy };
        level.exitTile = { tx, ty };
      }
      if (ch === 'L') {
        level.loot.push({ kind: 'small', x: cx, y: cy, tx, ty, taken: false, phase: Math.random() * 6 });
      }
      if (ch === 'C') level.coins.push({ x: cx, y: cy, tx, ty, taken: false, phase: Math.random() * 6 });
      if (ch === 'V' && !seenVault.has(tx + ',' + ty)) {
        const tiles = floodVault(tx, ty);
        let sx = 0;
        let sy = 0;
        for (const [vx, vy] of tiles) {
          sx += (vx + 0.5) * TILE;
          sy += (vy + 0.5) * TILE;
        }
        level.loot.push({
          kind: 'vault',
          x: sx / tiles.length,
          y: sy / tiles.length,
          tx,
          ty,
          taken: false,
          phase: Math.random() * 6,
          width: tiles.length,
        });
      }
    }
  }
  // Lasers are contiguous runs of | in one column: one beam per run.
  for (let tx = 0; tx < COLS; tx++) {
    let run = null;
    for (let ty = 0; ty <= ROWS; ty++) {
      const ch = ty < ROWS ? grid[ty][tx] : '#';
      if (ch === LASER && !run) run = { tx, top: ty, bottom: ty };
      else if (ch === LASER && run) run.bottom = ty;
      else if (run) {
        level.lasers.push({ tx, top: run.top, bottom: run.bottom, timer: 0, active: true });
        run = null;
      }
    }
  }
  return level;
}

export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return level.grid[ty][tx];
}

export function isSolidTile(level, tx, ty) {
  return SOLID.has(tileAt(level, tx, ty));
}

// Can a circle of radius r stand at (x, y) without overlapping a wall?
export function canStand(level, x, y, r) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolidTile(level, tx, ty)) continue;
      const bx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const by = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      const dx = x - bx;
      const dy = y - by;
      if (dx * dx + dy * dy < r * r) return false;
    }
  }
  return true;
}

// Move with sliding: try the full step, then each axis alone.
export function moveBody(level, body, dx, dy) {
  const r = body.radius;
  if (canStand(level, body.x + dx, body.y + dy, r)) {
    body.x += dx;
    body.y += dy;
    return;
  }
  if (canStand(level, body.x + dx, body.y, r)) body.x += dx;
  else if (canStand(level, body.x, body.y + dy, r)) body.y += dy;
}

export function tileKindAt(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function isShadowAt(level, x, y) {
  return tileKindAt(level, x, y) === SHADOW;
}

export function isVentAt(level, x, y) {
  return tileKindAt(level, x, y) === VENT;
}

// Line of sight: step along the segment and stop at the first solid tile.
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidTile(level, Math.floor((x0 + dx * t) / TILE), Math.floor((y0 + dy * t) / TILE))) return false;
  }
  return true;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Angle from (x0, y0) to (x1, y1), and the smallest signed gap between two angles.
export function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

export function angleGap(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
