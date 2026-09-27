export const config = {
  tower: {
    levels: 18,
    blocksPerLevel: 3,
    blockSize: {
      width: 2.5,
      height: 1.5,
      depth: 7.5
    },
    mass: 1
  },
  physics: {
    timestep: 1 / 120,
    gravity: -9.81,
    friction: 0.5,
    restitution: 0
  },
  debug: {
    showInspector: false,
    showPhysics: false
  },
  hands: {
    stiffness: 800, // Stronger spring
    damping: 40,
    maxPushForce: 500, // Massive push force
    gripStrength: 500,
    handMass: 10, // Heavier hand so it doesn't bounce off easily
    baseMoveForce: 50,
    speed: 10
  }
};
