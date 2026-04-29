import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConfigStore } from "./configStore.js";
import { createMotorService } from "./nodemcuClient.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

dotenv.config({
  path: path.resolve(currentDirPath, "../.env")
});

const app = express();
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST?.trim() || "0.0.0.0";
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const configStore = createConfigStore(path.resolve(currentDirPath, "../.runtime-config.json"));
const persistedConfig = await configStore.read();
const initialBaseUrl =
  persistedConfig.nodemcuBaseUrl?.trim() || process.env.NODEMCU_BASE_URL?.trim() || "";
const motorService = createMotorService({
  baseUrl: initialBaseUrl,
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

app.get("/api/config", (_request, response) => {
  response.json({
    nodemcuBaseUrl: motorService.baseUrl,
    configured: motorService.hasDevice
  });
});

app.post("/api/config", async (request, response) => {
  const nodemcuBaseUrl = String(request.body?.nodemcuBaseUrl ?? "").trim().replace(/\/+$/, "");

  try {
    if (!nodemcuBaseUrl) {
      response.status(400).json({
        error: "NODEMCU_BASE_URL is required."
      });
      return;
    }

    const parsedUrl = new URL(nodemcuBaseUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      response.status(400).json({
        error: "NODEMCU_BASE_URL must start with http:// or https://."
      });
      return;
    }

    motorService.setBaseUrl(nodemcuBaseUrl);
    await configStore.write({
      nodemcuBaseUrl
    });

    response.json({
      nodemcuBaseUrl,
      configured: true
    });
  } catch (error) {
    response.status(400).json({
      error: "NODEMCU_BASE_URL must be a valid URL."
    });
  }
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

app.listen(port, host, () => {
  console.log(`Motor control backend listening on http://${host}:${port}`);
  console.log(
    motorService.hasDevice
      ? `Forwarding motor commands to ${motorService.baseUrl}`
      : "NODEMCU_BASE_URL is not set. Backend is not connected to the ESP controller."
  );
});
