import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { createScene } from "./render/scene";
import { setupDebugPanel } from "./debug/panel";

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  if (!canvas) {
    throw new Error("Could not find render canvas");
  }

  const scene = await createScene(canvas);
  setupDebugPanel(scene);
}

main().catch(console.error);
