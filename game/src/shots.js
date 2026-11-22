// shots.js — staged moments for the screenshots. Each one is a real state
// of the running game: the same room, the same guards mid-patrol, the same
// cones sweeping — just the thief, the guards and the alarm placed where
// the frame tells the heist best. The browser renders them; nothing is
// drawn, composited or borrowed from outside the game.

import { TILE } from './config.js';

function place(state, tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

// name: cover | stealth | getaway | vault. Returns the level to load.
export function shotLevel(name) {
  if (name === 'cover') return 1;
  if (name === 'getaway') return 1;
  if (name === 'vault') return 2;
  return 0;
}

export function applyShot(state, name) {
  const thief = state.thief;
  if (name === 'cover') {
    // Level 2, mid-heist: the thief crossing the hall between two patrols,
    // both cameras sweeping, a relic glowing ahead, the alarm half up.
    const t = place(state, 15, 9);
    thief.x = t.x;
    thief.y = t.y;
    thief.angle = -Math.PI / 2;
    const g0 = state.guards[0];
    const p0 = place(state, 11, 8);
    g0.x = p0.x; g0.y = p0.y; g0.angle = 0.15; g0.suspicion = 30;
    const g1 = state.guards[1];
    const p1 = place(state, 22, 12);
    g1.x = p1.x; g1.y = p1.y; g1.angle = Math.PI - 0.4; g1.suspicion = 10;
    state.cameras[0].phase = 0.9;
    state.cameras[1].phase = 2.2;
    state.level.loot[0].taken = true;
    state.lootTaken = 1;
    state.score = 100;
    thief.coins = 4;
    state.alarm = 50;
    state.time = 42;
    state.levelTime = 42;
    return;
  }
  if (name === 'stealth') {
    // Level 1: the thief flat in the shadow while a cone sweeps past the
    // crate, a breath away. The alarm is barely awake.
    const t = place(state, 17, 9);
    thief.x = t.x;
    thief.y = t.y;
    thief.angle = -Math.PI / 2;
    thief.sneaking = true;
    const g0 = state.guards[0];
    const p0 = place(state, 13, 8);
    g0.x = p0.x; g0.y = p0.y; g0.angle = 0.9; g0.suspicion = 18;
    state.cameras[0].phase = 2.6;
    state.alarm = 20;
    state.time = 28;
    state.levelTime = 28;
    return;
  }
  if (name === 'getaway') {
    // Level 2: everything stolen, the van door glowing, the alarm high
    // and both guards closing in. The payoff of the whole plan.
    const t = place(state, 27, 15);
    thief.x = t.x;
    thief.y = t.y;
    thief.angle = Math.PI / 2;
    for (const item of state.level.loot) item.taken = true;
    state.lootTaken = state.level.loot.length;
    state.score = 700;
    thief.coins = 6;
    const g0 = state.guards[0];
    const p0 = place(state, 22, 13);
    g0.x = p0.x; g0.y = p0.y; g0.mode = 'hunt'; g0.suspicion = 90;
    g0.lastSeenX = thief.x; g0.lastSeenY = thief.y;
    const g1 = state.guards[1];
    const p1 = place(state, 24, 10);
    g1.x = p1.x; g1.y = p1.y; g1.mode = 'hunt'; g1.suspicion = 85;
    g1.lastSeenX = thief.x; g1.lastSeenY = thief.y;
    state.cameras[0].phase = 1.4;
    state.cameras[1].phase = 0.4;
    state.alarm = 100;
    state.lockdown = true;
    state.time = 88;
    state.levelTime = 88;
    return;
  }
  if (name === 'vault') {
    // Level 3: under the Grand Vault with the laser grid live, three
    // patrols and three cameras. The hardest room, at its tensest.
    const t = place(state, 13, 11);
    thief.x = t.x;
    thief.y = t.y;
    thief.angle = -Math.PI / 2;
    const g0 = state.guards[0];
    const p0 = place(state, 9, 8);
    g0.x = p0.x; g0.y = p0.y; g0.angle = 0.5; g0.suspicion = 40;
    const g1 = state.guards[1];
    const p1 = place(state, 20, 6);
    g1.x = p1.x; g1.y = p1.y; g1.angle = 2.6; g1.suspicion = 15;
    const g2 = state.guards[2];
    const p2 = place(state, 16, 13);
    g2.x = p2.x; g2.y = p2.y; g2.angle = -0.4; g2.suspicion = 25;
    for (const laser of state.level.lasers) laser.timer = 0;
    state.cameras[0].phase = 0.5;
    state.cameras[1].phase = 1.8;
    state.cameras[2].phase = 2.9;
    state.level.loot[0].taken = true;
    state.level.loot[1].taken = true;
    state.lootTaken = 2;
    state.score = 200;
    thief.coins = 3;
    state.alarm = 60;
    state.time = 64;
    state.levelTime = 64;
  }
}
