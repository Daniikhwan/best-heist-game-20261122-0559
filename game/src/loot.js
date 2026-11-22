// loot.js — what the thief came for. Paintings, gems and the vault prize
// pay in score and in coins (the tools are not free). Coins on the floor
// are the small change that keeps a heist flexible. Take everything, then
// the getaway door is the only thing left that matters.

export function allLootTaken(state) {
  return state.level.loot.every((item) => item.taken);
}

export function updateLoot(state) {
  const thief = state.thief;
  const level = state.level;
  for (const item of level.loot) {
    if (item.taken) continue;
    const reach = item.kind === 'vault' ? 52 : 36;
    if (Math.hypot(thief.x - item.x, thief.y - item.y) < reach) {
      item.taken = true;
      const value = item.kind === 'vault' ? level.def.lootValue.vault : level.def.lootValue.small;
      state.score += value;
      thief.coins += item.kind === 'vault' ? 4 : 2;
      state.lootTaken += 1;
      state.events.push({ type: 'loot', kind: item.kind, value, x: item.x, y: item.y });
      if (allLootTaken(state)) {
        state.events.push({ type: 'all-loot' });
      }
    }
  }
  for (const coin of level.coins) {
    if (coin.taken) continue;
    if (Math.hypot(thief.x - coin.x, thief.y - coin.y) < 34) {
      coin.taken = true;
      thief.coins += 1;
      state.score += 10;
      state.events.push({ type: 'coin-pickup', x: coin.x, y: coin.y });
    }
  }
}

// Level clear: everything taken and the thief standing in the doorway.
export function atExitWithLoot(state) {
  if (!allLootTaken(state)) return false;
  const thief = state.thief;
  return Math.hypot(thief.x - state.level.exit.x, thief.y - state.level.exit.y) < 34;
}
