// input.js — keyboard and mouse, kept in one place so the game never has
// to wonder what the player pressed. Arrow keys and WASD move, Shift sneaks,
// 1/2/3 (or Q/E/R) spend tools, a mouse click throws a coin at the point,
// M mutes, P pauses, Enter starts.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 },
    pressed: new Set(), // keys pressed since the last frame was consumed
  };

  const GAME_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ',
    'w', 'a', 's', 'd', 'W', 'A', 'S', 'D',
  ]);

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.key)) event.preventDefault();
    if (!event.repeat) {
      input.keys.add(event.key);
      input.pressed.add(event.key);
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.key);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    input.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.clicked = true;
    input.mouse.clickX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    input.mouse.clickY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });

  input.axis = () => {
    let x = 0;
    let y = 0;
    if (input.keys.has('ArrowLeft') || input.keys.has('a') || input.keys.has('A')) x -= 1;
    if (input.keys.has('ArrowRight') || input.keys.has('d') || input.keys.has('D')) x += 1;
    if (input.keys.has('ArrowUp') || input.keys.has('w') || input.keys.has('W')) y -= 1;
    if (input.keys.has('ArrowDown') || input.keys.has('s') || input.keys.has('S')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  };

  input.sneaking = () => input.keys.has('Shift');
  input.wasPressed = (key) => input.pressed.has(key);
  input.consumeClick = () => {
    const clicked = input.mouse.clicked;
    input.mouse.clicked = false;
    return clicked;
  };
  input.endFrame = () => {
    input.pressed.clear();
  };

  return input;
}
