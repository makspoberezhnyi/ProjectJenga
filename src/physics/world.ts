import { Scene, Vector3, HavokPlugin } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { config } from "../config";

let havokPlugin: HavokPlugin | null = null;

export async function initPhysics(scene: Scene): Promise<HavokPlugin> {
  const havokInstance = await HavokPhysics();
  havokPlugin = new HavokPlugin(true, havokInstance);
  scene.enablePhysics(new Vector3(0, config.physics.gravity, 0), havokPlugin);
  
  // Set fixed timestep
  havokPlugin.setTimeStep(config.physics.timestep);
  
  return havokPlugin;
}

export function getHavokPlugin(): HavokPlugin {
  if (!havokPlugin) {
    throw new Error("Physics not initialized");
  }
  return havokPlugin;
}

export function updatePhysicsConfig(scene: Scene) {
  if (havokPlugin) {
    havokPlugin.setTimeStep(config.physics.timestep);
    scene.getPhysicsEngine()?.setGravity(new Vector3(0, config.physics.gravity, 0));
  }
}
