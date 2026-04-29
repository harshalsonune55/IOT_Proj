const defaultState = {
  currentSpeed: 0,
  targetSpeed: 0,
  online: false,
  source: "unconfigured",
  updatedAt: new Date().toISOString()
};

const clampSpeed = (speed, maxSpeed) => {
  const parsed = Number(speed);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(parsed), 0), maxSpeed);
};

export function createMotorService({
  baseUrl,
  maxSpeed = 100,
  pollTimeoutMs = 3000
}) {
  let state = { ...defaultState };
  const normalizedBaseUrl = baseUrl?.replace(/\/+$/, "") ?? "";

  const hasDevice = Boolean(normalizedBaseUrl);

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), pollTimeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers ?? {})
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function mergeState(nextState) {
    state = {
      ...state,
      ...nextState,
      updatedAt: new Date().toISOString()
    };

    return state;
  }

  async function readRemoteState() {
    const response = await fetchWithTimeout(`${normalizedBaseUrl}/motor/status`);

    if (!response.ok) {
      throw new Error(`NodeMCU status request failed with ${response.status}`);
    }

    const payload = await response.json();

    return mergeState({
      currentSpeed: clampSpeed(payload.currentSpeed, maxSpeed),
      targetSpeed: clampSpeed(payload.targetSpeed ?? payload.currentSpeed, maxSpeed),
      online: payload.online ?? true,
      source: "nodemcu"
    });
  }

  async function writeRemoteSpeed(speed) {
    const sendJsonCommand = async () => {
      const response = await fetchWithTimeout(`${normalizedBaseUrl}/motor/speed`, {
        method: "POST",
        body: JSON.stringify({ speed })
      });

      if (!response.ok) {
        throw new Error(`NodeMCU speed update failed with ${response.status}`);
      }

      return response.json();
    };

    const sendQueryCommand = async () => {
      const response = await fetchWithTimeout(
        `${normalizedBaseUrl}/motor/speed?speed=${encodeURIComponent(speed)}`
      );

      if (!response.ok) {
        throw new Error(`NodeMCU GET speed update failed with ${response.status}`);
      }

      return response.json();
    };

    let payload = await sendJsonCommand();

    // Some ESP WebServer builds accept the request but do not expose the JSON body
    // through `server.arg("plain")`. If that happens, retry using a query parameter.
    if (clampSpeed(payload.targetSpeed ?? payload.currentSpeed, maxSpeed) !== speed) {
      payload = await sendQueryCommand();
    }

    return mergeState({
      currentSpeed: clampSpeed(payload.currentSpeed ?? speed, maxSpeed),
      targetSpeed: clampSpeed(payload.targetSpeed ?? speed, maxSpeed),
      online: payload.online ?? true,
      source: "nodemcu"
    });
  }

  return {
    get maxSpeed() {
      return maxSpeed;
    },
    get hasDevice() {
      return hasDevice;
    },
    get baseUrl() {
      return normalizedBaseUrl;
    },
    async getStatus() {
      if (!hasDevice) {
        return mergeState({
          online: false,
          source: "unconfigured",
          error: "NODEMCU_BASE_URL is not set. Backend is not connected to the ESP controller."
        });
      }

      try {
        return await readRemoteState();
      } catch (error) {
        return mergeState({
          online: false,
          source: "fallback",
          error: error.message
        });
      }
    },
    async setSpeed(speed) {
      const nextSpeed = clampSpeed(speed, maxSpeed);

      if (!hasDevice) {
        return mergeState({
          targetSpeed: nextSpeed,
          online: false,
          source: "unconfigured",
          error: "NODEMCU_BASE_URL is not set. Command was not sent to the ESP controller."
        });
      }

      try {
        return await writeRemoteSpeed(nextSpeed);
      } catch (error) {
        return mergeState({
          targetSpeed: nextSpeed,
          online: false,
          source: "fallback",
          error: error.message
        });
      }
    }
  };
}
