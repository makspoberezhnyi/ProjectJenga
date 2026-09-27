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
    
    // Adjust visual offset so the "pointing finger" aligns with the physics sphere
    // These offsets depend on the glb's origin. Assuming we need to push it back and down slightly.
    rootNode.position = new Vector3(0, -0.5, 0); 
    
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
      marker
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

  // Update marker visuals
  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];
    hand.marker.position.copyFrom(hand.targetPos);
    
    if (hand.marker.material) {
      const mat = hand.marker.material as StandardMaterial;
      if (i === activeHandIndex) {
        // Active hand is brightly colored (Green for 0, Red for 1)
        if (i === 0) {
          mat.diffuseColor = new Color3(0, 1, 0);
          mat.emissiveColor = new Color3(0, 1, 0);
        } else {
          mat.diffuseColor = new Color3(1, 0, 0);
          mat.emissiveColor = new Color3(1, 0, 0);
        }
        mat.alpha = 0.8;
      } else {
        // Inactive hand is grey and ghosted
        mat.diffuseColor = new Color3(0.5, 0.5, 0.5);
        mat.emissiveColor = new Color3(0.2, 0.2, 0.2);
        mat.alpha = 0.3;
      }
    }
  }

  // Handle Animations
  const gripAnim = activeHand.animGroups.find(ag => ag.name === "Grip");
  const poseAnim = activeHand.animGroups.find(ag => ag.name === "Pose" || ag.name === "pose");
  
  if (input.l2 > 0.1) {
    if (gripAnim && !gripAnim.isPlaying) {
      gripAnim.play(true);
      if (poseAnim) poseAnim.stop();
    }
  } else if (input.r2 > 0.1) {
    if (poseAnim && !poseAnim.isPlaying) {
      poseAnim.play(true);
      if (gripAnim) gripAnim.stop();
    }
  } else {
    // Idle
    if (gripAnim && gripAnim.isPlaying) gripAnim.stop();
    if (poseAnim && poseAnim.isPlaying) poseAnim.stop();
  }

  // Apply spring force to all hands
  for (const hand of hands) {
    // Current state
    const pos = hand.aggregate.transformNode.position;
    const vel = hand.aggregate.body.getLinearVelocity();
    
    // Spring formula: F = k * (target - current) - c * velocity
    const diff = hand.targetPos.subtract(pos);
    const springForce = diff.scale(config.hands.stiffness);
    const dampingForce = vel.scale(config.hands.damping);
    
    const force = springForce.subtract(dampingForce);
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
