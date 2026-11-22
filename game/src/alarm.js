// alarm.js — the alarm meter. It is the highest suspicion any guard or
// camera holds right now, smoothed so it climbs and falls instead of
// jumping. At 100 the museum locks down: every guard hunts, the lights go
// red, and the thief has to break line of sight to cool it back down.
// Lasers add their own heat: crossing a live beam is almost as bad as
// being seen.

import { TILE } from './config.js';
import { ALARM_DECAY } from './config.js';

export const LASER_ALARM_RATE = 55;
export const LASER_PERIOD = 3.6; // seconds per on/off cycle
export const LASER_ON_FRACTION = 0.6;

export function updateLasers(state, dt) {
  for (const laser of state.level.lasers) {
    laser.timer += dt;
    const phase = (laser.timer % LASER_PERIOD) / LASER_PERIOD;
    laser.active = phase < LASER_ON_FRACTION;
  }
}

export function thiefOnLaser(state) {
  const thief = state.thief;
  for (const laser of state.level.lasers) {
    if (!laser.active) continue;
    const x = (laser.tx + 0.5) * TILE;
    const top = laser.top * TILE;
    const bottom = (laser.bottom + 1) * TILE;
    if (Math.abs(thief.x - x) < thief.radius + 5 && thief.y > top && thief.y < bottom) return laser;
  }
  return null;
}

export function updateAlarm(state, dt) {
  let peak = 0;
  for (const guard of state.guards) peak = Math.max(peak, guard.suspicion);
  for (const camera of state.cameras) peak = Math.max(peak, camera.suspicion);

  const laser = thiefOnLaser(state);
  if (laser) {
    peak = Math.max(peak, 90);
    state.alarm = Math.min(100, state.alarm + LASER_ALARM_RATE * dt);
    state.events.push({ type: 'laser', x: state.thief.x, y: state.thief.y });
  }

  // The meter chases the peak quickly upward and drifts down slowly.
  if (peak > state.alarm) {
    state.alarm = Math.min(100, state.alarm + (peak - state.alarm) * Math.min(1, dt * 6) + dt * 4);
  } else {
    state.alarm = Math.max(peak, state.alarm - ALARM_DECAY * dt);
  }
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

  if (state.alarm >= 100 && !state.lockdown) {
    state.lockdown = true;
    for (const guard of state.guards) {
      if (guard.mode !== 'hunt') {
        guard.mode = 'hunt';
        guard.lastSeenX = state.thief.x;
        guard.lastSeenY = state.thief.y;
      }
    }
    state.events.push({ type: 'lockdown' });
  }
  if (state.alarm < 55 && state.lockdown) {
    state.lockdown = false;
    for (const guard of state.guards) {
      if (guard.mode === 'hunt') guard.mode = 'search';
    }
    state.events.push({ type: 'cooled' });
  }
}
