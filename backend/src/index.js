import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMotorService } from "./nodemcuClient.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

dotenv.config({
  path: path.resolve(currentDirPath, "../.env")
});

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const motorService = createMotorService({
  baseUrl: process.env.NODEMCU_BASE_URL?.trim(),
  maxSpeed: Number(process.env.MOTOR_MAX_SPEED ?? 100),
  pollTimeoutMs: Number(process.env.POLL_TIMEOUT_MS ?? 3000)
});

app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins
  })
);
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/motor/status", async (_request, response) => {
  const status = await motorService.getStatus();

  response.json({
    ...status,
    maxSpeed: motorService.maxSpeed
  });
});

app.post("/api/motor/speed", async (request, response) => {
  const status = await motorService.setSpeed(request.body?.speed);

  response.json({
    ...status,
    maxSpeed: motorService.maxSpeed
  });
});

app.listen(port, () => {
  console.log(`Motor control backend listening on http://localhost:${port}`);
  console.log(
    motorService.hasDevice
      ? `Forwarding motor commands to ${motorService.baseUrl}`
      : "NODEMCU_BASE_URL is not set. Backend is not connected to the ESP controller."
  );
});
