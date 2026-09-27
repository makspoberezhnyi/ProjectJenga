import { Scene, Mesh, MeshBuilder, Vector3, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Color3, Physics6DoFConstraint, PhysicsConstraintAxis, Ray, SceneLoader, TransformNode, ArcRotateCamera } from "@babylonjs/core";
import "@babylonjs/loaders";
import { config } from "../config";
import { InputState } from "../input/gamepad";
import { nextTurn } from "../ui/gameUi";
import { GameState } from "../main";

export interface Hand {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
  targetPos: Vector3;
  side: number;
  animGroups: any[];
  marker: Mesh;
  rotator: TransformNode;
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
    
    const rotatorNode = new TransformNode(`rotator_${i}`, scene);
    rotatorNode.parent = physicsMesh;

    // Attach the visual hand to the rotator
    rootNode.parent = rotatorNode;
    rootNode.scaling = new Vector3(15, 15, 15);
    
    // Natively the hand points towards +Z. 
    // We must clear the GLB's native rotationQuaternion to fix the 90-degree pitch
    rootNode.rotationQuaternion = null;
    rootNode.rotation = new Vector3(0, 0, 0);
    
    // We push the wrist back to -2.5 so the fingertips sit at the physics sphere (0,0,0)
    rootNode.position = new Vector3(0, -0.5, -2.5);
    
    // Apply a skin-like color to all sub-meshes
    const skinMat = new StandardMaterial(`skin_${i}`, scene);
    skinMat.diffuseColor = new Color3(0.9, 0.7, 0.5); 
    skinMat.specularColor = new Color3(0.1, 0.1, 0.1);
    
    rootNode.getChildMeshes().forEach(m => {
      m.material = skinMat;
    });

    // If it's the left hand (side = -1), mirror it visually
    if (side === -1) {
      rootNode.scaling.x *= -1;
    }
    
    // Initial position away from the tower
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
      rotator: rotatorNode
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
  

  
  // 1. Stick exclusively for Horizontal controls (Camera relative)
  const cam = scene.activeCamera as ArcRotateCamera;
  const forward = cam.getDirection(Vector3.Forward());
  forward.y = 0;
  forward.normalize();
  
  const right = cam.getDirection(Vector3.Right());
  right.y = 0;
  right.normalize();

  // Stick UP (negative leftStick.y) means move FORWARD (towards the tower if camera looks at it)
  const moveForward = -input.leftStick.y * config.hands.speed * dt;
  const moveRight = input.leftStick.x * config.hands.speed * dt;
  
  activeHand.targetPos.addInPlace(forward.scale(moveForward));
  activeHand.targetPos.addInPlace(right.scale(moveRight));
  
  // 2. D-pad exclusively for Vertical controls (Y)
  // D-pad UP (negative Y) moves the hand UP (positive Y in world)
  const dpadSpeed = config.hands.speed * 0.5;
  activeHand.targetPos.y -= input.dpad.y * dpadSpeed * dt;

  
  if (activeHandIndex === 0) {
    // ---- PUSH HAND (Green marker, R2) ----
    // R2 can still be used for a quick lunge forward if desired
    if (input.r2 > 0.1) {
      activeHand.targetPos.z -= 5.0 * input.r2 * config.hands.speed * dt * activeHand.side;
    }
    if (activeConstraint) releaseGrip();
    
  } else {
    // ---- PULL HAND (Red marker, L2) ----
    // L2 acts purely as a GRIP toggle while free roaming
    if (input.l2 > 0.1) {
      if (!activeConstraint) {
        tryGrip(scene, activeHand);
      }
    } else {
      if (activeConstraint) releaseGrip();
    }
  }
  
  // Give them the WHOLE ROOM: Relax the boundaries significantly!
  activeHand.targetPos.y = Math.max(0.5, Math.min(50, activeHand.targetPos.y)); // Can fly way above tower
  activeHand.targetPos.x = Math.max(-20, Math.min(20, activeHand.targetPos.x)); // Whole table width
  activeHand.targetPos.z = Math.max(-20, Math.min(20, activeHand.targetPos.z)); // Whole table depth

  // Update marker visuals to strictly follow the physical hand (the physics collision sphere)
  // This ensures if the hand hits a block, the marker stops too, providing accurate feedback.
  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];
    hand.marker.position.copyFrom(hand.aggregate.transformNode.position);
    
    if (i === activeHandIndex) {
      // Active hand has full physics collisions enabled
      hand.aggregate.shape.filterCollideMask = 0xFFFFFFFF;
    } else {
      // Inactive hand has physics collisions disabled ("no physics on it")
      hand.aggregate.shape.filterCollideMask = 0;
    }
    
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
    
    // Auto-targeting: Empty hands always point their fingers at the tower
    const isHoldingBlock = (i === activeHandIndex && activeConstraint !== null);
    if (!isHoldingBlock) {
      // Look at the tower center (0, y, 0)
      // Since fingertips are pushed to -2.5 and +Z points outward natively,
      // setting lookAt to the tower will perfectly aim the fingers at the tower!
      const towerCenter = new Vector3(0, hand.aggregate.transformNode.position.y, 0);
      hand.rotator.lookAt(towerCenter);
    } else {
      // If holding a block, it just maintains its world rotation from when it was grabbed.
      // (The constraint locks it to the dummy sphere which doesn't rotate).
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
    activeConstraint.dispose();
    
    // Check if the block was placed on top of the tower
    if (grabbedBody.transformNode) {
      const blockPos = grabbedBody.transformNode.getAbsolutePosition();
      // If the block is dropped significantly higher than the initial tower height
      // The initial tower is 18 levels * 1.5 height + some gap = roughly 28 units high.
      // Let's say if y > 25, it was placed on top (or at least dropped from above).
      if (blockPos.y > 25) {
        nextTurn(GameState.isMultiplayer);
      }
    }
  }
  activeConstraint = null;
  grabbedBody = null;
}
