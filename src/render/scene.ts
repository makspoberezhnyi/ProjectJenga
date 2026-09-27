import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, DirectionalLight, MeshBuilder, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Color3, Color4 } from "@babylonjs/core";
import { initPhysics } from "../physics/world";
import { buildTower } from "../physics/tower";
import { config } from "../config";

let scene: Scene;
let engine: Engine;

export async function createScene(canvas: HTMLCanvasElement): Promise<Scene> {
  engine = new Engine(canvas, true);
  scene = new Scene(engine);

  // Cartoony clear color (sky blue)
  scene.clearColor = new Color4(0.4, 0.7, 0.9, 1.0);

  // Soft ambient lighting (bright)
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.9;
  light.groundColor = new Color3(0.3, 0.3, 0.3);

  // Directional light for shadows and contrast
  const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), scene);
  dirLight.intensity = 0.7;

  // Orbit camera
  const camera = new ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 40, new Vector3(0, 15, 0), scene);
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 10; // Lower number means faster zoom

  // Initialize Physics
  await initPhysics(scene);

  // Build table (vibrant green like cartoony grass/mat)
  const table = MeshBuilder.CreateBox("table", { width: 40, height: 1, depth: 40 }, scene);
  table.position.y = -0.5;
  const tableMat = new StandardMaterial("tableMat", scene);
  tableMat.diffuseColor = new Color3(0.2, 0.8, 0.3); // Vibrant green
  tableMat.specularColor = new Color3(0.1, 0.1, 0.1); // Less shiny
  table.material = tableMat;
  table.enableEdgesRendering();
  table.edgesWidth = 2.0;
  table.edgesColor = new Color4(0, 0.3, 0, 1);
  
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
