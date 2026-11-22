// guards.js — the patrol. A guard walks its waypoints, pauses to look
// around, and watches a cone in front of it. When it sees the thief its
// suspicion climbs; at 100 the whole museum goes into lockdown and every
// guard hunts. A guard that bumps into the thief while calm is startled
// first — the chase, and the catch, only follow a real sighting.

import { TILE } from './config.js';
import {
  SPOT_RATE_GUARD,
  SPOT_RATE_SHADOW,
  SPOT_RATE_VENT,
  SPOT_DECAY,
  CAUGHT_DISTANCE,
} from './config.js';
import {
  moveBody,
  hasLineOfSight,
  isShadowAt,
  isVentAt,
  angleTo,
  angleGap,
  distance,
} from './level.js';
import { segmentThroughSmoke } from './thief.js';

export const GUARD_RANGE = 210;
export const GUARD_HALF_ANGLE = 0.62; // ~71 degrees of vision
export const HUNT_SPEED = 148;
export const PATROL_SPEED = 1; // multiplied by the guard's own speed

export function createGuards(def, level) {
  return def.guards.map((g) => {
    const first = g.waypoints[0];
    return {
      waypoints: g.waypoints.map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE })),
      speed: g.speed,
      pause: g.pause,
      waypointIndex: 1,
      x: (first[0] + 0.5) * TILE,
      y: (first[1] + 0.5) * TILE,
      radius: 15,
      angle: 0,
      scanBase: 0,
      scanTimer: 0,
      pauseTimer: 0,
      mode: 'patrol',
      suspicion: 0,
      investigateX: 0,
      investigateY: 0,
      lastSeenX: 0,
      lastSeenY: 0,
      bob: Math.random() * 6,
    };
  });
}

function guardSeesThief(state, guard) {
  const thief = state.thief;
  const level = state.level;
  const dist = distance(guard.x, guard.y, thief.x, thief.y);
  if (dist > GUARD_RANGE) return 0;
  const toThief = angleTo(guard.x, guard.y, thief.x, thief.y);
  if (Math.abs(angleGap(toThief, guard.angle)) > GUARD_HALF_ANGLE) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, thief.x, thief.y)) return 0;
  if (segmentThroughSmoke(state, guard.x, guard.y, thief.x, thief.y)) return 0;
  let rate = SPOT_RATE_GUARD;
  if (isShadowAt(level, thief.x, thief.y) || thief.sneaking) rate *= SPOT_RATE_SHADOW;
  if (isVentAt(level, thief.x, thief.y)) rate *= SPOT_RATE_VENT;
  const closeness = 1 + (1 - dist / GUARD_RANGE) * 0.8;
  return rate * closeness;
}

export function updateGuards(state, dt) {
  const level = state.level;
  const thief = state.thief;
  for (const guard of state.guards) {
    guard.bob += dt * 6;

    // Suspicion: climb while the thief is in the cone, fall while hidden.
    const seen = guardSeesThief(state, guard);
    if (seen > 0) {
      guard.suspicion = Math.min(100, guard.suspicion + seen * dt);
      guard.lastSeenX = thief.x;
      guard.lastSeenY = thief.y;
      if (guard.suspicion > 55 && guard.mode === 'patrol') guard.mode = 'investigate';
      if (guard.suspicion >= 100) guard.mode = 'hunt';
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - SPOT_DECAY * dt);
      if (guard.mode === 'investigate' && guard.suspicion <= 0) guard.mode = 'patrol';
    }

    // A guard that walks into the thief is startled: full alarm, chase on.
    const touch = distance(guard.x, guard.y, thief.x, thief.y);
    if (touch < CAUGHT_DISTANCE + 4 && guard.mode === 'patrol') {
      guard.suspicion = 100;
      guard.mode = 'hunt';
      guard.lastSeenX = thief.x;
      guard.lastSeenY = thief.y;
      state.events.push({ type: 'startled', x: thief.x, y: thief.y });
    }
    if (touch < CAUGHT_DISTANCE && (guard.mode === 'hunt' || guard.suspicion > 70)) {
      state.caught = true;
      state.events.push({ type: 'caught' });
      return;
    }

    if (guard.mode === 'hunt') {
      const targetX = seen > 0 ? thief.x : guard.lastSeenX;
      const targetY = seen > 0 ? thief.y : guard.lastSeenY;
      const d = distance(guard.x, guard.y, targetX, targetY);
      if (d > 8) {
        const ang = angleTo(guard.x, guard.y, targetX, targetY);
        guard.angle = ang;
        moveBody(level, guard, Math.cos(ang) * HUNT_SPEED * dt, Math.sin(ang) * HUNT_SPEED * dt);
      }
      if (seen <= 0 && d <= 10) {
        guard.mode = 'search';
        guard.pauseTimer = 2.2;
      }
      continue;
    }

    if (guard.mode === 'search') {
      guard.pauseTimer -= dt;
      guard.angle += Math.sin(guard.pauseTimer * 2.4) * dt * 1.6;
      if (guard.pauseTimer <= 0) {
        guard.mode = 'patrol';
        guard.suspicion = Math.max(0, guard.suspicion - 30);
      }
      continue;
    }

    if (guard.mode === 'investigate') {
      const d = distance(guard.x, guard.y, guard.investigateX, guard.investigateY);
      if (d > 10) {
        const ang = angleTo(guard.x, guard.y, guard.investigateX, guard.investigateY);
        guard.angle = ang;
        moveBody(level, guard, Math.cos(ang) * guard.speed * 1.25 * dt, Math.sin(ang) * guard.speed * 1.25 * dt);
      } else {
        guard.pauseTimer -= dt;
        guard.angle += Math.sin(guard.pauseTimer * 3) * dt * 1.8;
        if (guard.pauseTimer <= -1.6) {
          guard.mode = 'patrol';
          guard.pauseTimer = 0;
        }
      }
      continue;
    }

    // Patrol: walk to the next waypoint, pause and scan at each one.
    if (guard.pauseTimer > 0) {
      guard.pauseTimer -= dt;
      guard.scanTimer += dt;
      guard.angle = guard.scanBase + Math.sin(guard.scanTimer * 1.4) * 0.7;
      if (guard.pauseTimer <= 0) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      }
      continue;
    }
    const target = guard.waypoints[guard.waypointIndex];
    const d = distance(guard.x, guard.y, target.x, target.y);
    if (d < 6) {
      guard.pauseTimer = guard.pause;
      guard.scanTimer = 0;
      guard.scanBase = guard.angle;
      continue;
    }
    const ang = angleTo(guard.x, guard.y, target.x, target.y);
    guard.angle = ang;
    moveBody(level, guard, Math.cos(ang) * guard.speed * PATROL_SPEED * dt, Math.sin(ang) * guard.speed * PATROL_SPEED * dt);
  }
}
