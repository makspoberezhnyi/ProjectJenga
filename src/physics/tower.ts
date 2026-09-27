import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core";
import { config } from "../config";

let blocks: any[] = [];
let blockMaterial: StandardMaterial;

export function buildTower(scene: Scene) {
  clearTower();

  if (!blockMaterial) {
    blockMaterial = new StandardMaterial("blockMat", scene);
    blockMaterial.diffuseColor = new Color3(0.8, 0.6, 0.4);
  }

  const { levels, blocksPerLevel, blockSize, mass } = config.tower;
  const { friction, restitution } = config.physics;

  const yOffset = blockSize.height / 2;

  for (let level = 0; level < levels; level++) {
    const isEven = level % 2 === 0;
    const y = yOffset + level * blockSize.height;

    for (let i = 0; i < blocksPerLevel; i++) {
      const block = MeshBuilder.CreateBox(`block_${level}_${i}`, {
        width: blockSize.width,
        height: blockSize.height,
        depth: blockSize.depth
      }, scene);
      
      block.material = blockMaterial;

      let x = 0;
      let z = 0;

      const spread = blockSize.width; // Distance between centers of blocks
      const offset = (i - 1) * spread;

      if (isEven) {
        // Oriented along Z axis
        x = offset;
      } else {
        // Oriented along X axis
        z = offset;
        block.rotation.y = Math.PI / 2;
      }

      block.position = new Vector3(x, y, z);

      // Add physics
      const aggregate = new PhysicsAggregate(
        block, 
        PhysicsShapeType.BOX, 
        { mass, friction, restitution }, 
        scene
      );

      // Disable sleeping initially so they settle, but they might sleep later
      blocks.push({ mesh: block, aggregate });
    }
  }
}

export function clearTower() {
  blocks.forEach(b => {
    b.aggregate.dispose();
    b.mesh.dispose();
  });
  blocks = [];
}

export function updateBlocksFriction() {
  const { friction } = config.physics;
  blocks.forEach(b => {
    b.aggregate.material.friction = friction;
  });
}
