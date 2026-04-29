# Motor Speed Control App

This project contains:

- `frontend/`: React web UI with a speed knob, current speed display, and status panel
- `backend/`: Node/Express API that can forward commands to a NodeMCU

## Architecture

The React app talks to the Node backend.

The Node backend:

- stores the latest speed state locally for development
- optionally forwards requests to the NodeMCU
- returns the latest current speed to the UI

## Expected NodeMCU API

Configure your firmware to expose:

- `GET /motor/status`
- `POST /motor/speed`

Example `GET /motor/status` response:

```json
{
  "currentSpeed": 42,
  "targetSpeed": 50,
  "online": true
}
```

Example `POST /motor/speed` request body:

```json
{
  "speed": 50
}
```

Example `POST /motor/speed` response:

```json
{
  "currentSpeed": 48,
  "targetSpeed": 50,
  "online": true
}
```

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create a backend env file:

```bash
cp backend/.env.example backend/.env
```

Update `backend/.env`:

```env
HOST=0.0.0.0
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
NODEMCU_BASE_URL=http://192.168.1.50
MOTOR_MAX_SPEED=100
POLL_TIMEOUT_MS=3000
```

If `NODEMCU_BASE_URL` is empty, the backend runs in mock mode so you can test the UI without hardware.

## Run

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in a separate terminal:

```bash
npm run dev:frontend
```

If you want the frontend to call a non-local backend, create `frontend/.env`:

```env
VITE_API_BASE_URL=http://YOUR_BACKEND_HOST:4000
```

Then open:

- `http://localhost:5173`

## Render Frontend + Mac Backend

If the frontend is hosted on Render and the backend is running on your Mac:

- run the backend with `HOST=0.0.0.0`
- set `FRONTEND_ORIGIN=https://YOUR_RENDER_APP.onrender.com`
- set Render env `VITE_API_BASE_URL` to your backend URL

Example backend env:

```env
HOST=0.0.0.0
PORT=4000
FRONTEND_ORIGIN=https://your-app.onrender.com
NODEMCU_BASE_URL=http://192.168.1.50
```

Important: `http://192.168.x.x:4000` only works if the browser can reach your Mac on the same network. A public Render site usually cannot call a private Mac LAN IP directly. For Render to reach your backend, you need one of these:

- a public IP with router port forwarding to your Mac
- a tunnel/reverse proxy such as Cloudflare Tunnel, Tailscale Funnel, or ngrok
- deploy the backend to a public host instead of your Mac

## Notes for NodeMCU firmware

Your NodeMCU should:

- connect to the same network as the backend machine
- expose the motor speed endpoints over HTTP
- return current measured speed if you have a sensor
- otherwise return the current PWM/target value as `currentSpeed`
