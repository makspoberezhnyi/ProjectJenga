# Browser Jenga with Gamepad Controls

## The idea

This is a multiplayer Jenga game that runs in the browser. Players join a lobby through a link, build their own avatar and take turns pulling blocks from a physics based tower. Everything is controlled with an Xbox or PlayStation controller, and the sticks and triggers move the player's hands, so pulling a block feels like doing it with real fingers.

Jenga is turn based. Only one player touches the tower at any moment, and this makes both the networking and the physics much simpler than in a typical real time multiplayer game.

All code is written by AI. The human tests every stage with a real controller, describes what feels wrong in plain words and decides when a stage is done.

## Tech stack

| Part | Choice | Why |
|---|---|---|
| Rendering and scene | Babylon.js | Close to a full engine, fast loading in the browser |
| Physics | Havok (`@babylonjs/havok`) with Babylon Physics V2 | Professional physics, keeps tall stacks stable |
| Debug tools | Babylon Inspector and `PhysicsViewer` | Live scene inspection, visible colliders |
| Live tuning | `lil-gui` | Sliders for friction, forces and springs while playing |
| Input | Browser Gamepad API | Built in, works with Xbox and PlayStation |
| Rumble | `gamepad.vibrationActuator` | Built in haptic feedback |
| Lobby and sync | PartyKit or Cloudflare Durable Objects | Cheap relay server, free tier is enough to start |
| Language | TypeScript | Fewer silly bugs, easier for AI to keep code consistent |
| Build tool | Vite | Fast dev server, simple setup |
| Version control | Git | Every finished stage is a commit, easy rollback |

The main reason for Babylon.js is load time. A friend clicks the link and should be in the lobby within a few seconds. Babylon.js still gives most of what an engine offers, like an inspector, physics debugging, GUI and gamepad support.

## Lobby by link

A player clicks "Create room" and gets a link like `jenga.app/#room=abc123`. Friends open the link and land in the same room. The server only forwards messages between players in that room and keeps the list of who is connected, so it does almost no work.

The room keeps a small amount of state. It stores the players with their avatars, the turn order, whose turn it is and the last agreed tower snapshot.

## Avoiding physics desync

If every client runs its own physics, the towers on different screens will drift apart within seconds. So only the active player runs the physics simulation. That player sends the position and rotation of every block about 20 times per second, and the other players render those positions with smooth interpolation, with their own physics bodies switched to animated mode.

When the turn ends, the active player sends one final snapshot. It becomes the official tower state for everyone, and the next player starts simulating from exactly that state.

### Network messages

| Message | Sent by | Content |
|---|---|---|
| `join` | New player | Name and avatar data |
| `lobby_state` | Server | Players, turn order, ready flags |
| `start_game` | Host | Seed for block randomness |
| `snapshot` | Active player | Positions and rotations of all blocks, hand positions |
| `turn_end` | Active player | Final tower snapshot, result (placed or collapsed) |
| `next_turn` | Server | ID of the next player |

The seed in `start_game` matters because every client must build the exact same tower with the same loose and tight blocks.

## Controls

A turn has two phases. In the first phase the player gets a block out of the tower. In the second phase the player carries it with both hands and places it on top.

### Phase 1: Pushing and pulling

| Input | Action |
|---|---|
| Left stick | Move the active hand around the tower and up or down between levels |
| Right stick | Rotate the camera |
| R2 (analog) | Push force, deeper press means harder push |
| Y / Triangle | Switch to the other hand on the opposite side |
| L2 (analog) | Grip strength with the pulling hand |
| Left stick while gripping | Pull the block out |
| B / Circle | Let go of the block |

### Phase 2: Placing

| Input | Action |
|---|---|
| Left stick | Move the block over the top of the tower |
| Right stick | Rotate the camera |
| L1 / R1 | Rotate the block by 90 degrees |
| A / Cross | Release the block |

### How the hands work physically

A kinematic or animated hand has unlimited force, so it would shove any block out, even a jammed one. This breaks the core of Jenga.

Instead, each fingertip is a small dynamic Havok body. Every physics step it gets pulled toward the target position from the controller by a spring force, and that force is capped. The cap depends on R2, so a light press can only move a loose block, and a jammed block does not move.

Gripping works the same way. When L2 is pressed and the hand touches a block end, the game creates a `Physics6DoFConstraint` with spring stiffness and damping between the hand and the block. If the player pulls too hard or too fast, the block drags its neighbours along, and this is where most towers will fall.

## What makes it feel like real Jenga

Real Jenga blocks are not identical. Tiny differences in thickness make some blocks loose and some blocks stuck, and the whole game is about finding the loose ones.

To copy this, every block gets a slightly random friction value and a slightly random height, both from the shared seed.

| Parameter | Suggested starting value |
|---|---|
| Block size | 1.5 x 2.5 x 7.5 units (real Jenga proportions) |
| Tower | 18 levels, 3 blocks per level, 54 blocks total |
| Physics timestep | Fixed at 1/120 second |
| Friction per block | Random between 0.4 and 0.7 |
| Height variation | Random within about 2 percent |
| Restitution | Close to 0, wooden blocks do not bounce |

All of these values live in one file, `src/config.ts`, and every value is also exposed as a slider in the debug panel. This way the human can tune the feel while playing, and the AI only needs to copy the final numbers back into the config.

Rumble adds a lot for very little work. When a block resists the push, the controller vibrates lightly, and the stronger the resistance, the stronger the rumble.

## Game rules

The tower counts as collapsed when any block other than the one in the player's hands drops below its original level by more than a small threshold, or touches the table.

A block counts as placed when it rests on the top level, the player has let go and the tower stays still for about 3 seconds. After that the turn passes to the next player.

A player may only take blocks from below the top complete level, which is the standard Jenga rule.

## Connect screen and tutorial

When the game opens, it shows a screen that says "Connect your controller and press any button". The browser fires a `gamepadconnected` event and gives the device name. If the name contains "Xbox" or "XInput", the game shows Xbox button icons. If it contains "DualSense", "DualShock" or "Wireless Controller", it shows PlayStation icons.

The tutorial uses a short three level tower with one glowing practice block. Each step only completes when the player actually does the action.

| Step | Task |
|---|---|
| 1 | Move your hand to the glowing block |
| 2 | Push it halfway out with R2 |
| 3 | Switch hands with Y / Triangle and pull it out with L2 |
| 4 | Place it on top and release with A / Cross |

## Avatars

The avatar is built from a few simple low poly parts: head shape, skin colour, eyes, hat and hand colour. All parts are made from Babylon.js primitive shapes, so no external model files are needed at the start.

An avatar is saved as a short list of numbers, for example `[2, 5, 1, 3, 7]`, one number per part. It is tiny, easy to send in the `join` message and easy to store in the browser.

## Project structure

```
src/
  main.ts            entry point, game state machine
  config.ts          every tunable number in one place
  debug/
    panel.ts         lil-gui sliders, inspector toggle, physics viewer
  render/
    scene.ts         Babylon scene, lights, camera, table
    avatars.ts       avatar parts and builder
  physics/
    world.ts         Havok setup, fixed timestep
    tower.ts         tower creation from seed
    hands.ts         finger bodies, capped spring forces, grip constraints
    rules.ts         collapse and placement checks
  input/
    gamepad.ts       polling, button mapping, Xbox vs PlayStation
    rumble.ts        haptic feedback
  net/
    room.ts          PartyKit connection
    sync.ts          snapshots and interpolation
  ui/
    connect.ts       connect controller screen
    tutorial.ts      four step tutorial
    lobby.ts         room link, player list, ready button
server/
  room.ts            PartyKit room server
```

## Build order

| Stage | Goal | Done when |
|---|---|---|
| 1 | Tower with physics on one screen | 54 blocks stand still for a minute without jitter |
| 2 | Gamepad hands | You can push and pull a block and it feels good |
| 3 | Randomness and rumble | Some blocks slide easily, some are stuck and you feel it |
| 4 | Full turn loop for one player | Pull, place and collapse detection all work |
| 5 | Connect screen and tutorial | A new person learns the controls without help |
| 6 | Lobby and sync | Two browsers play a full game through one link |
| 7 | Avatars | Players see each other's characters in the lobby and at the table |

Stage 2 is the real test of the whole project. If pushing and pulling a block feels satisfying, everything after that is mostly plumbing. It makes sense to spend extra time here before moving on.

---

# Working with Claude Code

## Rules for the AI

Paste this block once at the start of the project, or save it as `CLAUDE.md` in the project root so Claude Code reads it automatically.

```
You are building a browser multiplayer Jenga game. The full design is in
docs/design.md. Read it before every stage.

Rules:
1. Work only on the stage I give you. Do not start the next stage.
2. Use TypeScript, Vite, Babylon.js and Havok (@babylonjs/havok).
3. Every tunable number goes into src/config.ts and gets a slider in the
   lil-gui debug panel.
4. Keep files small and follow the project structure in the design doc.
5. After finishing, run the dev server, fix any console errors, and tell me
   exactly what to test with the controller.
6. When I report a problem, explain the likely cause in one or two sentences,
   then fix it.
7. Commit to Git after I confirm a stage works, with a message like
   "Stage 2: gamepad hands".
```

## Stage prompts

Copy one prompt at a time. Test, report problems, and only move on when the "Done when" check from the build order passes.

### Stage 1: Tower with physics

```
Stage 1. Set up the project with Vite, TypeScript, Babylon.js and Havok.
Create a scene with a table, soft lighting and an orbit camera. Build a
Jenga tower of 18 levels with 3 blocks per level, blocks sized
1.5 x 2.5 x 7.5, each level rotated 90 degrees. Use a fixed physics timestep
of 1/120. Add the lil-gui debug panel with sliders for friction, gravity and
timestep, a button to rebuild the tower, and toggles for the Babylon
Inspector and PhysicsViewer. The tower must stand still with no jitter for
at least one minute.
```

### Stage 2: Gamepad hands

```
Stage 2. Read the gamepad with the Gamepad API. Add two hands made of small
dynamic Havok bodies, one on each side of the tower. Implement the Phase 1
controls from the design doc. The push hand is pulled toward its target by a
spring force capped by R2. The pull hand grips a block end with a
Physics6DoFConstraint when L2 is pressed. Show a small marker where the
active hand is aiming. Add sliders for spring stiffness, damping, max push
force and grip strength. Also add keyboard fallback controls for debugging.
```

### Stage 3: Randomness and rumble

```
Stage 3. Add a seeded random generator. Give every block a random friction
between 0.4 and 0.7 and a random height variation within 2 percent, both
driven by the seed. Show the seed in the debug panel with a button to reroll.
Add rumble through vibrationActuator that grows with how much the pushed
block resists. Add a debug toggle that colours blocks by friction so I can
check the randomness.
```

### Stage 4: Full turn loop

```
Stage 4. Implement a game state machine: pull phase, place phase, settle
check, turn end, collapse. Add the Phase 2 placing controls from the design
doc. Implement the rules: no taking blocks from the top complete level,
collapse when any block other than the held one drops below its level or
touches the table, success when the tower stays still for 3 seconds after
placing. Show simple on screen messages for each state.
```

### Stage 5: Connect screen and tutorial

```
Stage 5. Add the connect controller screen. Detect Xbox or PlayStation from
the gamepad id and show the right button icons everywhere in the game. Build
the four step tutorial from the design doc on a three level tower with one
glowing practice block. Each step completes only when the player does the
action. Add a skip button for returning players.
```

### Stage 6: Lobby and sync

```
Stage 6. Add a PartyKit server and the lobby. Creating a room gives a link
with the room id in the URL hash. Show the player list, ready buttons and a
start button for the host. Implement the sync model from the design doc: only
the active player simulates, sends snapshots 20 times per second, others
interpolate with animated bodies, the final snapshot at turn end becomes the
shared state. Use all message types from the design doc. Handle a player
leaving mid game by skipping their turn.
```

### Stage 7: Avatars

```
Stage 7. Build the avatar creator from Babylon primitive shapes with five
parts: head shape, skin colour, eyes, hat and hand colour. Store the avatar
as an array of numbers, save it in localStorage and send it in the join
message. Show avatars in the lobby and seat them around the table during the
game. The active player's hands use their chosen hand colour.
```

## How to report problems

Short and concrete reports get the fastest fixes. One problem per message works best.

| Instead of | Write |
|---|---|
| "Physics is broken" | "The tower slowly leans left and falls after about 20 seconds" |
| "Controls feel weird" | "The hand keeps moving for half a second after I release the stick" |
| "Pulling does not work" | "L2 grips the block, but pulling does nothing unless I press R2 too" |
