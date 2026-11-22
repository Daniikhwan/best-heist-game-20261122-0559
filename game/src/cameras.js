// cameras.js — the wall cameras. Each one sweeps its red cone back and
// forth across its arc. A camera spots faster than a guard and never gets
// tired — but an EMP puts every camera to sleep for a few seconds, and a
// thief in shadow or smoke is hard for a lens to hold.

import { TILE } from './config.js';
import { SPOT_RATE_CAMERA, SPOT_RATE_SHADOW, SPOT_RATE_VENT, SPOT_DECAY } from './config.js';
import { hasLineOfSight, isShadowAt, isVentAt, angleGap, distance } from './level.js';
import { segmentThroughSmoke } from './thief.js';

export const CAMERA_HALF_ANGLE = 0.34;

export function createCameras(def) {
  return def.cameras.map((c) => ({
    x: (c.tx + 0.5) * TILE,
    y: (c.ty + 0.5) * TILE,
    baseAngle: c.angle,
    sweep: c.sweep,
    speed: c.speed,
    range: c.range,
    angle: c.angle,
    phase: Math.random() * 6,
    suspicion: 0,
    disabled: 0,
  }));
}

export function updateCameras(state, dt) {
  const level = state.level;
  const thief = state.thief;
  for (const camera of state.cameras) {
    camera.phase += dt * camera.speed;
    camera.angle = camera.baseAngle + Math.sin(camera.phase) * camera.sweep;
    camera.disabled = Math.max(0, camera.disabled - dt);
    if (thief.empTimer > 0) camera.disabled = Math.max(camera.disabled, thief.empTimer);
    if (camera.disabled > 0) {
      camera.suspicion = Math.max(0, camera.suspicion - SPOT_DECAY * 2 * dt);
      continue;
    }
    const dist = distance(camera.x, camera.y, thief.x, thief.y);
    let seen = 0;
    if (dist <= camera.range) {
      const toThief = Math.atan2(thief.y - camera.y, thief.x - camera.x);
      if (Math.abs(angleGap(toThief, camera.angle)) <= CAMERA_HALF_ANGLE) {
        if (hasLineOfSight(level, camera.x, camera.y, thief.x, thief.y)) {
          if (!segmentThroughSmoke(state, camera.x, camera.y, thief.x, thief.y)) {
            seen = SPOT_RATE_CAMERA;
            if (isShadowAt(level, thief.x, thief.y) || thief.sneaking) seen *= SPOT_RATE_SHADOW;
            if (isVentAt(level, thief.x, thief.y)) seen *= SPOT_RATE_VENT;
            seen *= 1 + (1 - dist / camera.range) * 0.7;
          }
        }
      }
    }
    if (seen > 0) camera.suspicion = Math.min(100, camera.suspicion + seen * dt);
    else camera.suspicion = Math.max(0, camera.suspicion - SPOT_DECAY * dt);
  }
}
