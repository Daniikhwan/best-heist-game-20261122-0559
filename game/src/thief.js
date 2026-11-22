// thief.js — the thief: movement, sneaking, and the three tools.
// A coin distracts, smoke blinds, an EMP sleeps the cameras. Every tool
// costs coins, and coins come from the floor and from the loot itself.

import { TILE } from './config.js';
import { TOOL_COST, TOOL_RANGE, SMOKE_SECONDS, EMP_SECONDS } from './config.js';
import { moveBody, isVentAt } from './level.js';

export const WALK_SPEED = 165;
export const SNEAK_SPEED = 95;
export const VENT_SPEED = 70;

export function createThief(start) {
  return {
    x: start.x,
    y: start.y,
    radius: 14,
    angle: -Math.PI / 2,
    moving: false,
    sneaking: false,
    inVent: false,
    coins: 2,
    smoke: [], // {x, y, r, t} clouds that block vision
    thrownCoin: null, // {x, y, tx, ty, t, landed}
    empTimer: 0,
    stepTimer: 0,
    bob: 0,
  };
}

// A click inside the room throws a coin at the point (key 1 / Q does the
// same toward the mouse). Returns the event the game should announce.
export function throwCoin(state, tx, ty) {
  const thief = state.thief;
  if (thief.coins < TOOL_COST.coin || thief.thrownCoin) return null;
  const dx = tx - thief.x;
  const dy = ty - thief.y;
  const dist = Math.hypot(dx, dy);
  if (dist > TOOL_RANGE.coin) {
    const s = TOOL_RANGE.coin / dist;
    tx = thief.x + dx * s;
    ty = thief.y + dy * s;
  }
  thief.coins -= TOOL_COST.coin;
  thief.thrownCoin = { x: thief.x, y: thief.y, tx, ty, t: 0, landed: false };
  return { type: 'coin-thrown' };
}

export function dropSmoke(state) {
  const thief = state.thief;
  if (thief.coins < TOOL_COST.smoke) return null;
  thief.coins -= TOOL_COST.smoke;
  thief.smoke.push({ x: thief.x, y: thief.y, r: 95, t: SMOKE_SECONDS });
  return { type: 'smoke' };
}

export function fireEmp(state) {
  const thief = state.thief;
  if (thief.coins < TOOL_COST.emp) return null;
  thief.coins -= TOOL_COST.emp;
  thief.empTimer = EMP_SECONDS;
  return { type: 'emp' };
}

export function updateThief(state, input, dt) {
  const thief = state.thief;
  const level = state.level;

  thief.empTimer = Math.max(0, thief.empTimer - dt);
  for (const cloud of thief.smoke) cloud.t -= dt;
  thief.smoke = thief.smoke.filter((cloud) => cloud.t > 0);

  if (thief.thrownCoin) {
    const coin = thief.thrownCoin;
    coin.t += dt;
    const k = Math.min(1, coin.t / 0.35);
    coin.x = coin.x + (coin.tx - coin.x) * Math.min(1, dt * 14);
    coin.y = coin.y + (coin.ty - coin.y) * Math.min(1, dt * 14);
    if (k >= 1 && !coin.landed) {
      coin.landed = true;
      coin.ring = 0;
      // The nearest guard inside earshot walks over to look.
      let best = null;
      let bestDist = 340;
      for (const guard of state.guards) {
        const d = Math.hypot(guard.x - coin.tx, guard.y - coin.ty);
        if (d < bestDist) {
          bestDist = d;
          best = guard;
        }
      }
      if (best) {
        best.mode = 'investigate';
        best.investigateX = coin.tx;
        best.investigateY = coin.ty;
        best.pauseTimer = 0;
      }
      state.events.push({ type: 'coin-landed', x: coin.tx, y: coin.ty });
    }
    if (coin.landed) {
      coin.ring = (coin.ring ?? 0) + dt * 90;
      if (coin.ring > 200) thief.thrownCoin = null;
    }
  }

  const axis = input.axis();
  thief.sneaking = input.sneaking();
  thief.inVent = isVentAt(level, thief.x, thief.y);
  let speed = thief.sneaking ? SNEAK_SPEED : WALK_SPEED;
  if (thief.inVent) speed = VENT_SPEED;
  thief.moving = axis.x !== 0 || axis.y !== 0;
  if (thief.moving) {
    thief.angle = Math.atan2(axis.y, axis.x);
    moveBody(level, thief, axis.x * speed * dt, axis.y * speed * dt);
    thief.bob += dt * (thief.sneaking ? 7 : 11);
    thief.stepTimer -= dt;
    if (thief.stepTimer <= 0) {
      thief.stepTimer = thief.sneaking ? 0.55 : 0.34;
      state.events.push({ type: 'step', quiet: thief.sneaking });
    }
  }

  // Tools: 1/Q coin, 2/E smoke, 3/R EMP. A mouse click is a coin throw.
  if (input.wasPressed('1') || input.wasPressed('q') || input.wasPressed('Q')) {
    const event = throwCoin(state, input.mouse.x, input.mouse.y);
    if (event) state.events.push(event);
  }
  if (input.wasPressed('2') || input.wasPressed('e') || input.wasPressed('E')) {
    const event = dropSmoke(state);
    if (event) state.events.push(event);
  }
  if (input.wasPressed('3') || input.wasPressed('r') || input.wasPressed('R')) {
    const event = fireEmp(state);
    if (event) state.events.push(event);
  }
  if (input.consumeClick()) {
    const event = throwCoin(state, input.mouse.clickX, input.mouse.clickY);
    if (event) state.events.push(event);
  }
}

// Is the segment blocked by a smoke cloud? A cloud hides whatever is
// behind it, so a cone that crosses one cannot see the thief.
export function segmentThroughSmoke(state, x0, y0, x1, y1) {
  for (const cloud of state.thief.smoke) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    let t = ((cloud.x - x0) * dx + (cloud.y - y0) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    if (Math.hypot(px - cloud.x, py - cloud.y) < cloud.r) return true;
  }
  return false;
}

export function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}
