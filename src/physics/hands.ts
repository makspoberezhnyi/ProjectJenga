import { Scene, MeshBuilder, Vector3, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Color3, Physics6DoFConstraint, PhysicsConstraintAxis, Ray } from "@babylonjs/core";
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

export function initHands(scene: Scene) {
  hands = [];
  
  const handMat = new StandardMaterial("handMat", scene);
  handMat.diffuseColor = new Color3(0.9, 0.1, 0.1);
  handMat.emissiveColor = new Color3(0.3, 0, 0);

  // Two hands on opposite sides (Z-axis)
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const mesh = MeshBuilder.CreateSphere(`hand_${i}`, { diameter: 0.8 }, scene);
    mesh.material = handMat;
    
    // Start position slightly away from the tower
    const startPos = new Vector3(0, 10, side * 6);
    mesh.position.copyFrom(startPos);
    
    const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.SPHERE, {
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

export function updateHands(scene: Scene, input: InputState, deltaTime: number) {
  if (hands.length === 0) return;

  // Switch hand
  if (input.yPressed) {
    activeHandIndex = (activeHandIndex + 1) % hands.length;
    releaseGrip(); // Let go when switching
  }

  const activeHand = hands[activeHandIndex];
  
  // Move target pos
  const dt = deltaTime / 1000;
  // Left stick moves X and Y
  // If active hand is on +Z side (side=1), moving stick right (x>0) moves target +X.
  // If on -Z side (side=-1), moving stick right should probably move target -X so it feels natural from that side.
  activeHand.targetPos.x += input.leftStick.x * config.hands.speed * dt * activeHand.side;
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
    // We want the target to just sit right outside the block's face or push into it
    // Push force R2 moves target slightly inward? Actually R2 just increases force cap.
    // The design doc says "The push hand is pulled toward its target by a spring force capped by R2".
    // If target is inside the tower, it pushes.
    // Let's make target rest at Z = side * 4 (just outside blocks).
    // When R2 is pressed, maybe we don't move the target, we just let the physical hand push towards it?
    // Wait, if target is at Z=4, and tower is at Z=3.75, it's outside.
    // To push, target MUST be inside the tower. Let's move target in when R2 is pressed.
    const pushZ = activeHand.side * (4.5 - 2.5 * input.r2); // Moves inwards up to 2.5 units
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
