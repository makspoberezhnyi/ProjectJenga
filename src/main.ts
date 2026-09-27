import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { createScene } from "./render/scene";
import { setupDebugPanel } from "./debug/panel";
import { showMenu } from "./ui/menu";
import { showGameUI } from "./ui/gameUi";

export const GameState = {
  isPlaying: false,
  isMultiplayer: false
};

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  if (!canvas) {
    throw new Error("Could not find render canvas");
  }

  const scene = await createScene(canvas);
  setupDebugPanel(scene);
  
  // Show Main Menu
  showMenu(
    () => {
      // Start Single Player
      GameState.isPlaying = true;
      GameState.isMultiplayer = false;
      showGameUI();
    },
    () => {
      // Create Lobby (Multiplayer Stub)
      GameState.isPlaying = true;
      GameState.isMultiplayer = true;
      showGameUI();
      alert("Lobby creation will be added in the multiplayer update!");
    }
  );
}

main().catch(console.error);
