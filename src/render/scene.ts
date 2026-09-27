import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Color3 } from "@babylonjs/core";
import { initPhysics } from "../physics/world";
import { buildTower } from "../physics/tower";
import { config } from "../config";

let scene: Scene;
let engine: Engine;

export async function createScene(canvas: HTMLCanvasElement): Promise<Scene> {
  engine = new Engine(canvas, true);
  scene = new Scene(engine);

  // Soft lighting
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  // Orbit camera
  const camera = new ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 40, new Vector3(0, 15, 0), scene);
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 50;

  // Initialize Physics
  await initPhysics(scene);

  // Build table
  const table = MeshBuilder.CreateBox("table", { width: 40, height: 1, depth: 40 }, scene);
  table.position.y = -0.5;
  const tableMat = new StandardMaterial("tableMat", scene);
  tableMat.diffuseColor = new Color3(0.4, 0.4, 0.4);
  table.material = tableMat;
  
  new PhysicsAggregate(table, PhysicsShapeType.BOX, { mass: 0, friction: config.physics.friction }, scene);

  // Build Jenga Tower
  buildTower(scene);

  // Run render loop
  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });

  return scene;
}

export function getScene(): Scene {
  return scene;
}
