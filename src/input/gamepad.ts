export interface InputState {
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  dpad: { x: number; y: number };
  r2: number;
  l2: number;
  yPressed: boolean;
  bPressed: boolean;
  aPressed: boolean;
  l1Pressed: boolean;
  r1Pressed: boolean;
  l1Held: boolean;
  r1Held: boolean;
}

const state: InputState = {
  leftStick: { x: 0, y: 0 },
  rightStick: { x: 0, y: 0 },
  dpad: { x: 0, y: 0 },
  r2: 0,
  l2: 0,
  yPressed: false,
  bPressed: false,
  aPressed: false,
  l1Pressed: false,
  r1Pressed: false,
  l1Held: false,
  r1Held: false
};

// Keyboard fallback keys
const keys = new Set<string>();

window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// Prevent sticky keys
let lastY = false;
let lastB = false;
let lastA = false;
let lastL1 = false;
let lastR1 = false;

export function updateInput(): InputState {
  // Gamepad
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp: Gamepad | null = null;
  for (const g of gamepads) {
    if (g) {
      gp = g;
      break;
    }
  }

  if (gp) {
    // Left stick (axes 0, 1)
    state.leftStick.x = applyDeadzone(gp.axes[0]);
    state.leftStick.y = applyDeadzone(gp.axes[1]);
    
    // Right stick (axes 2, 3)
    state.rightStick.x = applyDeadzone(gp.axes[2]);
    state.rightStick.y = applyDeadzone(gp.axes[3]);

    // D-Pad (buttons 12: Up, 13: Down, 14: Left, 15: Right)
    // Map to x (left/right) and y (up/down). Note: up is usually negative y for sticks, but let's make up = positive 1, down = -1 for intuition.
    // Wait, stick Y: up is -1. Let's match stick behavior: Up = -1, Down = 1.
    const up = gp.buttons[12]?.pressed ? -1 : 0;
    const down = gp.buttons[13]?.pressed ? 1 : 0;
    const left = gp.buttons[14]?.pressed ? -1 : 0;
    const right = gp.buttons[15]?.pressed ? 1 : 0;
    
    state.dpad.x = left + right;
    state.dpad.y = up + down;

    // R2 is button 7, L2 is button 6
    state.r2 = gp.buttons[7]?.value || 0;
    state.l2 = gp.buttons[6]?.value || 0;

    // Y is button 3
    state.yPressed = gp.buttons[3]?.pressed || false;
    
    // B is button 1
    state.bPressed = gp.buttons[1]?.pressed || false;

    // A is button 0
    state.aPressed = gp.buttons[0]?.pressed || false;

    // L1 is button 4, R1 is button 5
    state.l1Pressed = gp.buttons[4]?.pressed || false;
    state.r1Pressed = gp.buttons[5]?.pressed || false;
  } else {
    // Keyboard fallback
    state.leftStick.x = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
    state.leftStick.y = (keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0);
    
    state.rightStick.x = (keys.has("l") ? 1 : 0) - (keys.has("j") ? 1 : 0);
    state.rightStick.y = (keys.has("k") ? 1 : 0) - (keys.has("i") ? 1 : 0);

    state.r2 = keys.has("e") ? 1 : 0; // Push
    state.l2 = keys.has("q") ? 1 : 0; // Pull/Grip
    
    state.yPressed = keys.has("y") || keys.has(" "); // Switch hand
    state.bPressed = keys.has("b") || keys.has("escape"); // Release
    state.aPressed = keys.has("enter"); // Place
    state.l1Pressed = keys.has("1");
    state.r1Pressed = keys.has("2");
  }

  // Edge triggers for one-time presses
  const currY = state.yPressed;
  state.yPressed = currY && !lastY;
  lastY = currY;

  const currB = state.bPressed;
  state.bPressed = currB && !lastB;
  lastB = currB;

  const currA = state.aPressed;
  state.aPressed = currA && !lastA;
  lastA = currA;

  const currL1 = state.l1Pressed;
  state.l1Pressed = currL1 && !lastL1;
  lastL1 = currL1;

  const currR1 = state.r1Pressed;
  state.r1Pressed = currR1 && !lastR1;
  lastR1 = currR1;

  state.l1Held = currL1;
  state.r1Held = currR1;

  return state;
}

function applyDeadzone(value: number, threshold = 0.15) {
  return Math.abs(value) < threshold ? 0 : value;
}
