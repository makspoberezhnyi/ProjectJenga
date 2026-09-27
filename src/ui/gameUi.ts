let currentPlayer = 1;

export function showGameUI() {
  const layer = document.getElementById("uiLayer");
  if (!layer) return;

  currentPlayer = 1;
  
  layer.innerHTML = `
    <div style="position: absolute; top: 20px; left: 20px; background: rgba(255, 255, 255, 0.9); padding: 15px 25px; border-radius: 15px; border: 3px solid black; font-weight: bold; font-size: 24px;">
      <span id="turnIndicator" style="color: #ff6b6b;">Player 1's Turn</span>
    </div>
    
    <div id="nextTurnOverlay" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 40px; border-radius: 20px; font-size: 48px; border: 4px solid white; text-align: center;">
      <div id="nextTurnText">Next Block!</div>
    </div>
  `;
}

export function nextTurn(isMultiplayer: boolean) {
  if (isMultiplayer) {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
  }
  
  const indicator = document.getElementById("turnIndicator");
  if (indicator) {
    indicator.innerText = isMultiplayer ? `Player ${currentPlayer}'s Turn` : `Single Player`;
    indicator.style.color = currentPlayer === 1 ? "#ff6b6b" : "#4ecdc4";
  }

  const overlay = document.getElementById("nextTurnOverlay");
  const text = document.getElementById("nextTurnText");
  if (overlay && text) {
    text.innerText = isMultiplayer ? `Player ${currentPlayer}'s Turn!` : "Next Block!";
    overlay.style.display = "block";
    
    // Hide overlay after 2 seconds
    setTimeout(() => {
      overlay.style.display = "none";
    }, 2000);
  }
}

export function hideGameUI() {
  const layer = document.getElementById("uiLayer");
  if (layer) layer.innerHTML = "";
}

export function showGameOver() {
  const layer = document.getElementById("uiLayer");
  if (!layer) return;

  layer.innerHTML = `
    <div style="background: rgba(255, 0, 0, 0.9); padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); pointer-events: auto; text-align: center; border: 4px solid black; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
      <h1 style="font-size: 64px; margin-top: 0; color: white; text-shadow: 2px 2px 0px #000;">GAME OVER</h1>
      <h2 style="color: white; margin-bottom: 30px;">Tower Collapsed!</h2>
      <button id="btnRestart" style="display: block; width: 250px; margin: 15px auto; padding: 15px; font-size: 24px; font-family: inherit; font-weight: bold; background: #fff; border: 3px solid black; border-radius: 10px; cursor: pointer; transition: transform 0.1s;">Restart</button>
    </div>
  `;

  document.getElementById("btnRestart")?.addEventListener("click", () => {
    window.location.reload();
  });
}
