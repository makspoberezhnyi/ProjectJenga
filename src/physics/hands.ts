import { Scene, Mesh, MeshBuilder, Vector3, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Color3, Color4, Physics6DoFConstraint, PhysicsConstraintAxis, Ray } from "@babylonjs/core";
import { config } from "../config";
import { InputState } from "../input/gamepad";

export interface Hand {
  mesh: any;
  aggregate: PhysicsAggregate;
  targetPos: Vector3;
  side: number; // 1 or -1
}

let hands: Hand[] = [];
let activeHandIndex = 0;
let marker: any;
let activeConstraint: Physics6DoFConstraint | null = null;
let grabbedBody: any = null;

function createArmMesh(scene: Scene, name: string, side: number, material: StandardMaterial): Mesh {
  // Forearm
  const forearm = MeshBuilder.CreateCylinder(name + "_forearm", { diameter: 0.6, height: 3 }, scene);
  forearm.rotation.x = Math.PI / 2;
  // Push forearm back so the hand is at z=0
  forearm.position.z = side * 1.5;

  // Palm
  const palm = MeshBuilder.CreateBox(name + "_palm", { width: 0.8, height: 0.4, depth: 0.8 }, scene);
  palm.position.z = side * 0; // Center

  // Thumb
  const thumb = MeshBuilder.CreateBox(name + "_thumb", { width: 0.3, height: 0.3, depth: 0.6 }, scene);
  thumb.position.x = 0.5;
  thumb.position.z = side * -0.2;

  // Fingers
  const f1 = MeshBuilder.CreateBox(name + "_f1", { width: 0.2, height: 0.2, depth: 0.8 }, scene);
  f1.position.x = -0.3;
  f1.position.z = side * -0.6;
  
  const f2 = MeshBuilder.CreateBox(name + "_f2", { width: 0.2, height: 0.2, depth: 0.8 }, scene);
  f2.position.x = 0;
  f2.position.z = side * -0.6;
  
  const f3 = MeshBuilder.CreateBox(name + "_f3", { width: 0.2, height: 0.2, depth: 0.8 }, scene);
  f3.position.x = 0.3;
  f3.position.z = side * -0.6;

  const merged = Mesh.MergeMeshes([forearm, palm, thumb, f1, f2, f3], true, true, undefined, false, true) as Mesh;
  merged.name = name;
  merged.material = material;
  
  merged.enableEdgesRendering();
  merged.edgesWidth = 3.0;
  merged.edgesColor = new Color4(0, 0, 0, 1);
  
  return merged;
}

export function initHands(scene: Scene) {
  hands = [];
  
  const handMat = new StandardMaterial("handMat", scene);
  handMat.diffuseColor = new Color3(0.2, 0.5, 1.0); // Blue
  handMat.emissiveColor = new Color3(0.1, 0.2, 0.4);
  handMat.alpha = 0.8; // Semi-transparent (less transparent to look solid)

  // Two hands on opposite sides (Z-axis)
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    
    // Create cartoony arm
    const mesh = createArmMesh(scene, `hand_${i}`, side, handMat);
    
    // Start position slightly away from the tower
    const startPos = new Vector3(0, 10, side * 7);
    mesh.position.copyFrom(startPos);
    
    // We can use a box shape for the physics of the hand
    const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.BOX, {
      mass: config.hands.handMass,
      friction: 0.5,
      restitution: 0
    }, scene);
    
    // Disable gravity for hands so they don't fall
    aggregate.body.setGravityFactor(0);

    hands.push({
      mesh,
      aggregate,
      targetPos: startPos.clone(),
      side
    });
  }

  // Create target marker
  marker = MeshBuilder.CreateSphere("marker", { diameter: 0.3 }, scene);
  const markerMat = new StandardMaterial("markerMat", scene);
  markerMat.diffuseColor = new Color3(0, 1, 0);
  markerMat.emissiveColor = new Color3(0, 1, 0);
  markerMat.alpha = 0.5;
  marker.material = markerMat;
}

export function getActiveHand() {
  return hands[activeHandIndex];
}

export function updateHands(scene: Scene, input: InputState, deltaTime: number): boolean {
  if (hands.length === 0) return false;

  let switched = false;
  // Switch hand
  if (input.yPressed) {
    activeHandIndex = (activeHandIndex + 1) % hands.length;
    releaseGrip(); // Let go when switching
    switched = true;
  }

  const activeHand = hands[activeHandIndex];
  
  // Move target pos
  const dt = deltaTime / 1000;
  // Inverting stick X so moving stick right physically moves target right on the screen.
  // Using activeHand.side so it is correct regardless of which side we are facing.
  activeHand.targetPos.x += input.leftStick.x * config.hands.speed * dt * -activeHand.side;
  activeHand.targetPos.y -= input.leftStick.y * config.hands.speed * dt;
  
  // Constrain target to tower area
  activeHand.targetPos.y = Math.max(0.5, Math.min(30, activeHand.targetPos.y));
  activeHand.targetPos.x = Math.max(-5, Math.min(5, activeHand.targetPos.x));
  
  // Also push/pull target along Z when gripping/pushing to allow movement in/out
  // But left stick while gripping pulls the block out!
  if (input.l2 > 0.1) {
    // Pulling out (move target Z away from tower)
    // stick Y moves Z now? Or stick X? Design says: "Left stick while gripping: Pull the block out"
    // So stick Y usually means up/down, let's use stick Y to pull out/push in.
    // Down stick (y > 0) pulls toward player.
    activeHand.targetPos.z += input.leftStick.y * config.hands.speed * dt * activeHand.side;
    // We already applied stick Y to targetPos.y, let's undo it if gripping
    activeHand.targetPos.y += input.leftStick.y * config.hands.speed * dt; 
  } else {
    // Normal resting Z position
    // Base is side * 6.5, fully pushed is side * 3.5 (which puts the palm inside the tower to push)
    const pushZ = activeHand.side * (6.5 - 3.0 * input.r2);
    activeHand.targetPos.z = pushZ;
  }

  // Update marker visual
  marker.position.copyFrom(activeHand.targetPos);

  // Apply spring force to all hands
  for (const hand of hands) {
    const isAct = (hand === activeHand);
    
    // Current state
    const pos = hand.aggregate.transformNode.position;
    const vel = hand.aggregate.body.getLinearVelocity();
    
    // Spring formula: F = k * (target - current) - c * velocity
    const diff = hand.targetPos.subtract(pos);
    const springForce = diff.scale(config.hands.stiffness);
    const dampingForce = vel.scale(config.hands.damping);
    
    let force = springForce.subtract(dampingForce);
    
    // Cap the force
    let maxF = config.hands.baseMoveForce;
    if (isAct) {
      if (input.r2 > 0.1) maxF += input.r2 * config.hands.maxPushForce;
      if (input.l2 > 0.1) maxF += input.l2 * config.hands.maxPushForce; // Also need force to pull
    }
    
    if (force.length() > maxF) {
      force = force.normalize().scale(maxF);
    }
    
    hand.aggregate.body.applyForce(force, pos);
  }

  // Handle Grip (L2)
  if (input.l2 > 0.1) {
    if (!activeConstraint) {
      // Try to grip something
      tryGrip(scene, activeHand);
    } else {
      // Update grip strength? We could update constraint max friction/force here if Havok allows.
    }
  } else {
    // Release
    if (activeConstraint || input.bPressed) {
      releaseGrip();
    }
  }

  return switched;
}

function tryGrip(scene: Scene, hand: Hand) {
  // Raycast from hand to find a block
  // A simpler way: we just find bodies overlapping or very close to the hand
  // For now, we will do a small raycast inwards
  const rayStart = hand.mesh.position;
  const rayDir = new Vector3(0, 0, -hand.side);
  const hit = scene.pickWithRay(new Ray(rayStart, rayDir, 1.5), (mesh) => mesh.name.startsWith("block_"));
  
  if (hit && hit.hit && hit.pickedMesh && hit.pickedMesh.physicsBody) {
    grabbedBody = hit.pickedMesh.physicsBody;
    
    // Create constraint
    activeConstraint = new Physics6DoFConstraint(
      {
        pivotA: new Vector3(0, 0, 0),
        pivotB: hit.pickedMesh.getAbsolutePosition().subtract(hand.mesh.position).scale(-1),
        perpAxisA: new Vector3(0, 1, 0),
        perpAxisB: new Vector3(0, 1, 0)
      },
      [
        { axis: PhysicsConstraintAxis.LINEAR_X, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.LINEAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_X, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      scene
    );
    
    hand.aggregate.body.addConstraint(grabbedBody, activeConstraint);
  }
}

function releaseGrip() {
  if (activeConstraint && grabbedBody) {
    // Remove constraint
    // In Havok/Babylon physics V2, disposing the constraint removes it
    activeConstraint.dispose();
  }
  activeConstraint = null;
  grabbedBody = null;
}
