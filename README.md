# AI-JEEP

AI-JEEP is an AIoT public transport safety monitoring system with:

- `edge/`: Python services for Raspberry Pi, webcam, and ESP32 integration
- `web/`: React + Vite + TypeScript dashboard with Convex backend

## Monorepo Layout

- Keep hardware/ML code inside `edge/`
- Keep dashboard code inside `web/`
- Deploy the `web/` directory to Vercel by setting it as the Root Directory
