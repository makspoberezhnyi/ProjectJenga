import { Scene, MeshBuilder, StandardMaterial, Color3, Color4, Vector3, PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core";
import { config } from "../config";

let blocks: any[] = [];
let blockMaterial: StandardMaterial;

export function buildTower(scene: Scene) {
  clearTower();

  if (!blockMaterial) {
    blockMaterial = new StandardMaterial("blockMat", scene);
    blockMaterial.diffuseColor = new Color3(0.95, 0.65, 0.2); // Vibrant cartoony wood
    blockMaterial.specularColor = new Color3(0.1, 0.1, 0.1); // Reduce shininess for cartoony look
    blockMaterial.emissiveColor = new Color3(0.2, 0.1, 0.0); // Slight inner glow to pop
  }

  const { levels, blocksPerLevel, blockSize, mass } = config.tower;
  const { friction, restitution } = config.physics;

  // We add a tiny gap vertically so blocks spawn slightly separated and fall into place,
  // proving that the physics engine is active and settling them.
  const dropGap = 0.05;
  const yOffset = blockSize.height / 2;

  for (let level = 0; level < levels; level++) {
    const isEven = level % 2 === 0;
    const y = yOffset + level * (blockSize.height + dropGap) + 1.0; // Drop from 1.0 height unit above table

    for (let i = 0; i < blocksPerLevel; i++) {
      const block = MeshBuilder.CreateBox(`block_${level}_${i}`, {
        width: blockSize.width,
        height: blockSize.height,
        depth: blockSize.depth
      }, scene);
      
      block.material = blockMaterial;
      
      // Add edges rendering so blocks are distinguishable
      block.enableEdgesRendering();
      block.edgesWidth = 4.0; // Thicker for bold cartoony look
      block.edgesColor = new Color4(0, 0, 0, 1.0); // Pure black
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
