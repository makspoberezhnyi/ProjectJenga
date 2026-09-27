import { Scene, Mesh, MeshBuilder, Vector3, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Color3, Physics6DoFConstraint, PhysicsConstraintAxis, Ray, SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders";
import { config } from "../config";
import { InputState } from "../input/gamepad";

export interface Hand {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
  targetPos: Vector3;
  side: number;
  animGroups: any[];
  marker: Mesh;
  baseZ: number;
}

let hands: Hand[] = [];
let activeHandIndex = 0;
let activeConstraint: Physics6DoFConstraint | null = null;
let grabbedBody: any = null;

export async function initHands(scene: Scene) {
  hands = [];
  
  let container: any;
  try {
    container = await SceneLoader.LoadAssetContainerAsync("/models/", "left_hand.glb", scene);
  } catch (e) {
    console.error("Could not load hand model", e);
    return;
  }

  // Two hands on opposite sides (Z-axis)
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    
    // Instantiate a full independent copy with its own animations and skeleton
    const instance = container.instantiateModelsToScene();
    const rootNode = instance.rootNodes[0] as Mesh;
    rootNode.name = `hand_${i}`;
    
    // Create a dummy small sphere for precise physics collision (fingertip size)
    const physicsMesh = MeshBuilder.CreateSphere(`physicsHand_${i}`, { diameter: 0.5 }, scene);
    physicsMesh.isVisible = false;

    // Attach the visual hand to the physics dummy
    rootNode.parent = physicsMesh;
    rootNode.scaling = new Vector3(15, 15, 15);
    
    // Adjust visual offset so the "pointing finger" aligns with the physics sphere.
    // The GLB origin is at the wrist. We need to push the visual mesh back
    // so the fingertips sit perfectly inside the physics sphere.
    // Since the mesh is scaled by 15, a typical 20cm hand becomes ~3 units long.
    // We push it back along the Z axis (away from the tower) depending on which side it is.
    rootNode.position = new Vector3(0, -0.5, side * 2.5); 
    
    // Apply a skin-like color to all sub-meshes
    const skinMat = new StandardMaterial(`skin_${i}`, scene);
    skinMat.diffuseColor = new Color3(0.9, 0.7, 0.5); 
    skinMat.specularColor = new Color3(0.1, 0.1, 0.1);
    
    rootNode.getChildMeshes().forEach(m => {
      m.material = skinMat;
    });

    // If it's the right hand (side = -1), mirror it visually
    if (side === -1) {
      rootNode.scaling.x *= -1;
      rootNode.rotation = new Vector3(0, 0, 0); 
    } else {
      rootNode.rotation = new Vector3(0, Math.PI, 0); 
    }
    
    const startPos = new Vector3(0, 10, side * 7);
    physicsMesh.position.copyFrom(startPos);
    
    // Physics aggregate is firmly attached to the 0.5m sphere!
    const aggregate = new PhysicsAggregate(physicsMesh, PhysicsShapeType.SPHERE, {
      mass: config.hands.handMass,
      friction: 0.5,
      restitution: 0
    }, scene);
    
    aggregate.body.setGravityFactor(0);
    aggregate.body.setMassProperties({
      mass: config.hands.handMass,
      inertia: new Vector3(0, 0, 0)
    });

    // Stop all animations initially
    for (const ag of instance.animationGroups) {
      ag.stop();
    }

    const marker = MeshBuilder.CreateSphere(`marker_${i}`, { diameter: 0.5 }, scene);
    const markerMat = new StandardMaterial(`markerMat_${i}`, scene);
    markerMat.alpha = 0.5;
    marker.material = markerMat;

    hands.push({
      mesh: physicsMesh,
      aggregate,
      targetPos: startPos.clone(),
      side,
      animGroups: instance.animationGroups,
      marker,
      baseZ: 6.5
    });
  }
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
  

  
  if (activeHandIndex === 0) {
    // ---- PUSH HAND (Green marker, R2) ----
    // Stick and D-Pad move the hand across the tower face (X and Y)
    activeHand.targetPos.x += (input.leftStick.x + input.dpad.x) * config.hands.speed * dt * -activeHand.side;
    activeHand.targetPos.y -= (input.leftStick.y + input.dpad.y) * config.hands.speed * dt;
    
    // R2 proportionally pushes the hand INTO the tower
    // Rests at 6.5 (away from tower), fully pressed moves to 3.5 (inside tower)
    const pushZ = activeHand.side * (6.5 - 3.0 * input.r2);
    activeHand.targetPos.z = pushZ;
    
    if (activeConstraint) releaseGrip();
    
  } else {
    // ---- PULL HAND (Red marker, L2) ----
    // Stick and D-Pad move the hand across the tower face (X and Y)
    activeHand.targetPos.x += (input.leftStick.x + input.dpad.x) * config.hands.speed * dt * -activeHand.side;
    activeHand.targetPos.y -= (input.leftStick.y + input.dpad.y) * config.hands.speed * dt;
    
    // L2 acts as a fluid reach-and-pull mechanism:
    // 0.0 -> 0.5: Hand reaches INTO the tower (from 6.5 to 3.6)
    // 0.5 -> 1.0: Hand pulls AWAY from the tower (from 3.6 to 8.6)
    let pullZ = 6.5;
    if (input.l2 <= 0.5) {
      pullZ = 6.5 - (input.l2 / 0.5) * 2.9; // Reach in
    } else {
      pullZ = 3.6 + ((input.l2 - 0.5) / 0.5) * 5.0; // Pull out
    }
    activeHand.targetPos.z = activeHand.side * pullZ;
    
    // Grip when past the halfway point (when it's touching the tower)
    if (input.l2 > 0.5) {
      if (!activeConstraint) {
        tryGrip(scene, activeHand);
      }
    } else {
      if (activeConstraint) releaseGrip();
    }
  }
  
  // Constrain target to tower area
  activeHand.targetPos.y = Math.max(0.5, Math.min(30, activeHand.targetPos.y));
  activeHand.targetPos.x = Math.max(-5, Math.min(5, activeHand.targetPos.x));

  // Update marker visuals to strictly follow the physical hand (the physics collision sphere)
  // This ensures if the hand hits a block, the marker stops too, providing accurate feedback.
  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];
    hand.marker.position.copyFrom(hand.aggregate.transformNode.position);
    
    if (hand.marker.material) {
      const mat = hand.marker.material as StandardMaterial;
      if (i === activeHandIndex) {
        if (i === 0) {
          mat.diffuseColor = new Color3(0, 1, 0); // Green = Push
          mat.emissiveColor = new Color3(0, 1, 0);
        } else {
          mat.diffuseColor = new Color3(1, 0, 0); // Red = Pull
          mat.emissiveColor = new Color3(1, 0, 0);
        }
        mat.alpha = 0.8;
      } else {
        mat.diffuseColor = new Color3(0.5, 0.5, 0.5);
        mat.emissiveColor = new Color3(0.2, 0.2, 0.2);
        mat.alpha = 0.3;
      }
    }
  }

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
      if (input.r2 > 0.1 && activeHandIndex === 0) maxF += input.r2 * config.hands.maxPushForce;
      if (input.l2 > 0.1 && activeHandIndex === 1) maxF += input.l2 * config.hands.maxPushForce;
    }
    
    if (force.length() > maxF) {
      force = force.normalize().scale(maxF);
    }
    
    hand.aggregate.body.applyForce(force, pos);
  }

  return switched;
}

function tryGrip(scene: Scene, hand: Hand) {
  // We do a raycast inwards towards the tower to find a block.
  // Using a 5.0 unit length to ensure it reaches the tower from the resting distance (6.5).
  const rayStart = hand.mesh.position;
  const rayDir = new Vector3(0, 0, -hand.side);
  const hit = scene.pickWithRay(new Ray(rayStart, rayDir, 5.0), (mesh) => mesh.name.startsWith("block_"));
  
  if (hit && hit.hit && hit.pickedMesh && hit.pickedMesh.physicsBody) {
    grabbedBody = hit.pickedMesh.physicsBody;
    
    // Convert hand world position to block local space for pivotB
    const invWorld = hit.pickedMesh.getWorldMatrix().clone().invert();
    const pivotB = Vector3.TransformCoordinates(hand.mesh.position, invWorld);
    
    // Convert world axes to block local space to prevent orientation snapping
    const axisA = new Vector3(1, 0, 0);
    const axisB = Vector3.TransformNormal(axisA, invWorld);
    
    const perpAxisA = new Vector3(0, 1, 0);
    const perpAxisB = Vector3.TransformNormal(perpAxisA, invWorld);
    
    // Create constraint
    activeConstraint = new Physics6DoFConstraint(
      {
        pivotA: new Vector3(0, 0, 0),
        pivotB: pivotB,
        axisA: axisA,
        axisB: axisB,
        perpAxisA: perpAxisA,
        perpAxisB: perpAxisB
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
