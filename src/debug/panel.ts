import GUI from "lil-gui";
import { Scene } from "@babylonjs/core";
import { config } from "../config";
import { buildTower, updateBlocksFriction } from "../physics/tower";
import { updatePhysicsConfig } from "../physics/world";



export function setupDebugPanel(scene: Scene) {
  const gui = new GUI({ title: "Jenga Debug" });

  const actions = {
    rebuildTower: () => {
      buildTower(scene);
    }
  };

  const towerFolder = gui.addFolder("Tower");
  towerFolder.add(actions, "rebuildTower").name("Rebuild Tower");
  towerFolder.open();

  const physicsFolder = gui.addFolder("Physics");
  physicsFolder.add(config.physics, "gravity", -20, 0, 0.1).name("Gravity").onChange(() => updatePhysicsConfig(scene));
  physicsFolder.add(config.physics, "friction", 0, 1, 0.01).name("Friction").onChange(() => updateBlocksFriction());
  physicsFolder.add(config.physics, "timestep", 0.001, 0.02, 0.001).name("Timestep").onChange(() => updatePhysicsConfig(scene));
  physicsFolder.open();

  const debugFolder = gui.addFolder("Debug Views");
  debugFolder.add(config.debug, "showInspector").name("Babylon Inspector").onChange((value: boolean) => {
    if (value) {
      scene.debugLayer.show();
    } else {
      scene.debugLayer.hide();
    }
  });

  const handsFolder = gui.addFolder("Hands");
  handsFolder.add(config.hands, "stiffness", 10, 1000, 10).name("Spring Stiffness");
  handsFolder.add(config.hands, "damping", 0, 100, 1).name("Damping");
  handsFolder.add(config.hands, "maxPushForce", 1, 200, 1).name("Max Push Force");
  handsFolder.add(config.hands, "gripStrength", 10, 500, 10).name("Grip Strength");
  handsFolder.open();
  
  debugFolder.add(config.debug, "showPhysics").name("Physics Viewer").onChange(async (value: boolean) => {
    // Requires PhysicsViewer from @babylonjs/core/Debug
    // Because it's optional, we'll dynamic import or use existing
    const { PhysicsViewer } = await import("@babylonjs/core/Debug/physicsViewer");
    
    // Simple toggle logic (would need a global reference to properly toggle off)
    // We'll manage it loosely for this stage
    if (value) {
      if (!(window as any).physicsViewerInstance) {
        (window as any).physicsViewerInstance = new PhysicsViewer(scene);
        scene.rootNodes.forEach(node => {
          if ((node as any).physicsBody) {
             (window as any).physicsViewerInstance.showBody((node as any).physicsBody);
          }
        });
        scene.onNewMeshAddedObservable.add((mesh) => {
          if (mesh.physicsBody) {
            (window as any).physicsViewerInstance?.showBody(mesh.physicsBody);
          }
        });
      }
    } else {
      if ((window as any).physicsViewerInstance) {
        (window as any).physicsViewerInstance.dispose();
        (window as any).physicsViewerInstance = null;
      }
    }
  });
  debugFolder.open();
}
