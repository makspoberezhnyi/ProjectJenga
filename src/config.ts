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
    stiffness: 400,
    damping: 40, // Critically damped for mass 1.0
    maxPushForce: 50, // (No longer used directly but kept for slider)
    gripStrength: 100,
    handMass: 1.0,
    baseMoveForce: 20, // (No longer used)
    speed: 15
  }
};
