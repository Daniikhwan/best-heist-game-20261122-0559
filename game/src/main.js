// main.js — The Midnight Vault. Boots the game, runs the loop, and owns the
// state machine: title, playing, paused, caught, room cleared, and the
// final getaway. A ?shot=cover|stealth|getaway|vault URL stages one moment
// of the game for a screenshot and then holds the room still.

import { VIEW_W, VIEW_H, LEVELS } from './config.js';
import { parseLevel } from './level.js';
import { createThief, updateThief } from './thief.js';
import { createGuards, updateGuards } from './guards.js';
import { createCameras, updateCameras } from './cameras.js';
import { updateLasers, updateAlarm } from './alarm.js';
import { updateLoot, atExitWithLoot } from './loot.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import {
  drawScene,
  drawTitle,
  drawPaused,
  drawCaught,
  drawLevelClear,
  drawWin,
} from './render.js';
import { shotLevel, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const audio = createAudio();
const input = createInput(canvas);

function loadBestScore() {
  try {
    return Number(window.localStorage.getItem('midnight-vault-best') || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    window.localStorage.setItem('midnight-vault-best', String(score));
  } catch {
    // A private window forgets. The heist goes on anyway.
  }
}

function createState(levelIndex) {
  const def = LEVELS[levelIndex];
  const level = parseLevel(def);
  return {
    screen: 'title',
    levelIndex,
    level,
    thief: createThief(level.start),
    guards: createGuards(def, level),
    cameras: createCameras(def),
    alarm: 0,
    maxAlarm: 0,
    lockdown: false,
    time: 0,
    levelTime: 0,
    score: 0,
    levelScore: 0,
    levelLootScore: 0,
    totalScore: 0,
    lootTaken: 0,
    caught: false,
    events: [],
    bestScore: loadBestScore(),
    visualTime: 0,
  };
}

let state = createState(0);
let shotFrames = 0;
// A staged screenshot renders exactly as placed: no warm-up updates, so
// no patrol drift can move a guard's cone onto the thief it was staged
// to just miss. The frame is a real render of the running game.
const SHOT_WARMUP_FRAMES = 0;

if (shotName) {
  const levelIndex = shotLevel(shotName);
  state = createState(levelIndex);
  state.screen = 'playing';
  applyShot(state, shotName);
  state.shotMode = true;
}

function loadLevel(index) {
  const keepTotal = state.totalScore;
  const keepBest = state.bestScore;
  state = createState(index);
  state.totalScore = keepTotal;
  state.bestScore = keepBest;
  state.screen = 'playing';
}

function clearLevel() {
  const def = state.level.def;
  const timeBonus = Math.max(0, Math.floor((def.parSeconds - state.levelTime) * 4));
  const ghost = state.maxAlarm < 60 ? 200 : 0;
  state.levelLootScore = state.score;
  state.levelScore = state.score + timeBonus + ghost;
  state.totalScore += state.levelScore;
  state.events.push({ type: 'level-clear' });
  state.screen = state.levelIndex >= LEVELS.length - 1 ? 'win' : 'clear';
  if (state.screen === 'win') {
    state.events.push({ type: 'win' });
    if (state.totalScore > state.bestScore) {
      state.bestScore = state.totalScore;
      saveBestScore(state.totalScore);
    }
  }
}

function update(dt) {
  state.time += dt;
  state.levelTime += dt;
  state.visualTime += dt;
  updateThief(state, input, dt);
  updateGuards(state, dt);
  updateCameras(state, dt);
  updateLasers(state, dt);
  updateAlarm(state, dt);
  updateLoot(state);

  if (state.caught) {
    state.screen = 'caught';
    state.events.push({ type: 'caught' });
    return;
  }
  if (atExitWithLoot(state)) {
    clearLevel();
  }
}

function drainEvents() {
  for (const event of state.events) audio.play(event);
  state.events.length = 0;
  audio.setAlarm(state.alarm);
}

function onKeyStart() {
  const clicked = input.consumeClick();
  if (input.wasPressed('Enter') || clicked) {
    audio.ensure();
    if (state.screen === 'title') {
      state.screen = 'playing';
      return true;
    }
    if (state.screen === 'clear') {
      loadLevel(state.levelIndex + 1);
      return true;
    }
    if (state.screen === 'win') {
      state.totalScore = 0;
      loadLevel(0);
      return true;
    }
  }
  return false;
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;

  if (state.screen === 'playing') {
    if (state.shotMode) {
      // A staged screenshot: let the room breathe for a moment, then hold.
      if (shotFrames < SHOT_WARMUP_FRAMES) {
        update(dt);
        shotFrames++;
      } else {
        state.visualTime += dt;
      }
    } else {
      update(dt);
    }
    if (input.wasPressed('p') || input.wasPressed('P') || input.wasPressed('Escape')) {
      state.screen = 'paused';
    }
    if (input.wasPressed('m') || input.wasPressed('M')) {
      audio.ensure();
      audio.toggleMute();
    }
  } else if (state.screen === 'paused') {
    if (input.wasPressed('p') || input.wasPressed('P') || input.wasPressed('Escape')) {
      state.screen = 'playing';
    }
  } else if (state.screen === 'title') {
    state.time += dt;
    state.visualTime += dt;
    updateThiefIdle(dt);
    onKeyStart();
  } else if (state.screen === 'caught') {
    if (input.wasPressed('r') || input.wasPressed('R')) {
      loadLevel(state.levelIndex);
    }
  } else if (state.screen === 'clear' || state.screen === 'win') {
    onKeyStart();
  }

  drainEvents();
  if (state.screen === 'title') drawTitle(ctx, state);
  else if (state.screen === 'paused') drawPaused(ctx, state);
  else if (state.screen === 'caught') drawCaught(ctx, state);
  else if (state.screen === 'clear') drawLevelClear(ctx, state);
  else if (state.screen === 'win') drawWin(ctx, state);
  else drawScene(ctx, state);

  input.endFrame();
  requestAnimationFrame(frame);
}

// Behind the title the museum stays alive: guards walk their rounds while
// the thief waits at the door.
function updateThiefIdle(dt) {
  updateGuards(state, dt);
  updateCameras(state, dt);
  updateLasers(state, dt);
}

requestAnimationFrame(frame);
