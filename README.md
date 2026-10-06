# Project Jenga

A browser-based multiplayer Jenga game featuring realistic physics and gamepad controls.

Players can join a lobby, take turns pulling blocks from a physics-based tower, and interact using an Xbox or PlayStation controller. The analog sticks and triggers give precise control over the player's hands, making block-pulling feel tactile and responsive.

## Tech Stack

- **Rendering:** [Babylon.js](https://www.babylonjs.com/) for fast, 3D browser rendering.
- **Physics:** Havok (`@babylonjs/havok`) for stable, professional-grade stack physics.
- **Networking:** [PartyKit](https://www.partykit.io/) & PartySocket for real-time multiplayer connections.
- **Controls:** Standard Browser Gamepad API with Rumble support (`gamepad.vibrationActuator`).
- **Tooling:** Vite, TypeScript, and `lil-gui` for live tuning friction, forces, and springs.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open the local URL provided by Vite in your browser.

### Build for Production

To build the project for production, run:
```bash
npm run build
```

This will compile TypeScript and bundle the application into the `dist/` directory.

## Design Details

For an in-depth look at the architecture, network synchronization, and physics handling, check out the [Game Design Document](jenga-browser-game-design.md).
