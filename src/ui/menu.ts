import { InputState } from "../input/gamepad";

let isMenuVisible = false;
let menuIndex = 0;
let lastDpadY = 0;
let lastStickY = 0;

export function showMenu(onStartSinglePlayer: () => void, onCreateLobby: () => void) {
  const layer = document.getElementById("uiLayer");
  if (!layer) return;

  layer.innerHTML = `
    <div style="background: rgba(255, 255, 255, 0.9); padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); pointer-events: auto; text-align: center; border: 4px solid black;">
      <h1 style="font-size: 48px; margin-top: 0; color: #ff6b6b; text-shadow: 2px 2px 0px #000;">JENGA</h1>
      <button id="btnStart" style="display: block; width: 250px; margin: 15px auto; padding: 15px; font-size: 24px; font-family: inherit; font-weight: bold; background: #4ecdc4; border: 3px solid black; border-radius: 10px; cursor: pointer; transition: transform 0.1s;">Single Player</button>
      <button id="btnLobby" style="display: block; width: 250px; margin: 15px auto; padding: 15px; font-size: 24px; font-family: inherit; font-weight: bold; background: #ffe66d; border: 3px solid black; border-radius: 10px; cursor: pointer; transition: transform 0.1s;">Create Lobby</button>
    </div>
  `;

  document.getElementById("btnStart")?.addEventListener("click", () => {
    hideMenu();
    onStartSinglePlayer();
  });
  
  document.getElementById("btnLobby")?.addEventListener("click", () => {
    hideMenu();
    onCreateLobby();
  });

  isMenuVisible = true;
  menuIndex = 0;
  updateMenuVisuals();
}

export function hideMenu() {
  isMenuVisible = false;
  const layer = document.getElementById("uiLayer");
  if (layer) layer.innerHTML = "";
}

export function updateMenuInput(state: InputState) {
  if (!isMenuVisible) return;
  
  const dpadY = state.dpad.y;
  const stickY = state.leftStick.y;
  
  let moved = 0; 
  if (dpadY < -0.5 && lastDpadY >= -0.5) moved = -1;
  if (stickY < -0.5 && lastStickY >= -0.5) moved = -1;
  if (dpadY > 0.5 && lastDpadY <= 0.5) moved = 1;
  if (stickY > 0.5 && lastStickY <= 0.5) moved = 1;
  
  lastDpadY = dpadY;
  lastStickY = stickY;
  
  if (moved !== 0) {
     menuIndex += moved;
     if (menuIndex < 0) menuIndex = 1;
     if (menuIndex > 1) menuIndex = 0;
     updateMenuVisuals();
  }
  
  if (state.aPressed) {
     if (menuIndex === 0) {
       document.getElementById("btnStart")?.click();
     } else {
       document.getElementById("btnLobby")?.click();
     }
  }
}

function updateMenuVisuals() {
  const btnStart = document.getElementById("btnStart");
  const btnLobby = document.getElementById("btnLobby");
  if (!btnStart || !btnLobby) return;
  
  if (menuIndex === 0) {
    btnStart.style.transform = "scale(1.1)";
    btnStart.style.border = "4px solid #333";
    btnStart.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    
    btnLobby.style.transform = "scale(1.0)";
    btnLobby.style.border = "3px solid black";
    btnLobby.style.boxShadow = "none";
  } else {
    btnLobby.style.transform = "scale(1.1)";
    btnLobby.style.border = "4px solid #333";
    btnLobby.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    
    btnStart.style.transform = "scale(1.0)";
    btnStart.style.border = "3px solid black";
    btnStart.style.boxShadow = "none";
  }
}
