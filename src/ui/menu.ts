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
}

export function hideMenu() {
  const layer = document.getElementById("uiLayer");
  if (layer) layer.innerHTML = "";
}
