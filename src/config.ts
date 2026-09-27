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
    damping: 20,
    maxPushForce: 20,
    gripStrength: 100, // Not fully used yet, but good for constraint
    handMass: 0.1,
    baseMoveForce: 5,
    speed: 10 // target move speed
  }
};
