import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;

  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function SpeedKnob({ value, maxSpeed, onChange, disabled }) {
  const size = 320;
  const center = size / 2;
  const radius = 104;
  const minAngle = 225;
  const maxAngle = 495;
  const angle = minAngle + (value / maxSpeed) * (maxAngle - minAngle);
  const marker = polarToCartesian(center, center, radius, angle);
  const trackPath = describeArc(center, center, radius, minAngle, maxAngle);
  const progressPath = describeArc(center, center, radius, minAngle, angle);
  const knobRef = useRef(null);

  const updateFromPointer = (clientX, clientY) => {
    const rect = knobRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    let rawAngle = (Math.atan2(y, x) * 180) / Math.PI + 90;

    if (rawAngle < 0) {
      rawAngle += 360;
    }

    let normalizedAngle = rawAngle;

    if (normalizedAngle < minAngle) {
      normalizedAngle += 360;
    }

    normalizedAngle = Math.min(Math.max(normalizedAngle, minAngle), maxAngle);

    const ratio = (normalizedAngle - minAngle) / (maxAngle - minAngle);

    onChange(Math.round(ratio * maxSpeed));
  };

  const handlePointerDown = (event) => {
    if (disabled) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event) => {
    if (disabled || event.buttons === 0) {
      return;
    }

    updateFromPointer(event.clientX, event.clientY);
  };

  return (
    <div className={`knob-shell${disabled ? " is-disabled" : ""}`}>
      <svg
        ref={knobRef}
        className="knob"
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        role="slider"
        aria-label="Motor speed"
        aria-valuemin={0}
        aria-valuemax={maxSpeed}
        aria-valuenow={value}
        tabIndex={0}
      >
        <defs>
          <linearGradient id="knobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#57d6ff" />
            <stop offset="100%" stopColor="#00ffa3" />
          </linearGradient>
        </defs>
        <path d={trackPath} className="knob-track" />
        <path d={progressPath} className="knob-progress" />
        <circle cx={center} cy={center} r="78" className="knob-body" />
        <circle cx={center} cy={center} r="56" className="knob-core" />
        <circle cx={marker.x} cy={marker.y} r="11" className="knob-marker" />
        <text x="50%" y="49%" textAnchor="middle" className="knob-value">
          {value}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="knob-unit">
          Speed %
        </text>
      </svg>
      <input
        className="knob-range"
        type="range"
        min="0"
        max={maxSpeed}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState({
    currentSpeed: 0,
    targetSpeed: 0,
    maxSpeed: 100,
    online: false,
    source: "mock",
    updatedAt: null
  });
  const [speedDraft, setSpeedDraft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initializedRef = useRef(false);

  async function fetchStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/motor/status`);

      if (!response.ok) {
        throw new Error("Unable to fetch motor status");
      }

      const payload = await response.json();
      setStatus(payload);
      if (!initializedRef.current) {
        setSpeedDraft(payload.targetSpeed);
        initializedRef.current = true;
      }
      setError(payload.error ?? "");
    } catch (requestError) {
      setStatus((currentStatus) => ({
        ...currentStatus,
        online: false,
        source: "offline"
      }));
      setError(requestError.message);
    }
  }

  useEffect(() => {
    fetchStatus();

    const intervalId = window.setInterval(fetchStatus, 2000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function applySpeed() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/motor/speed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ speed: speedDraft })
      });

      if (!response.ok) {
        throw new Error("Unable to update speed");
      }

      const payload = await response.json();
      setStatus(payload);
      setSpeedDraft(payload.targetSpeed);
      setError(payload.error ?? "");
    } catch (requestError) {
      setStatus((currentStatus) => ({
        ...currentStatus,
        online: false,
        source: "offline"
      }));
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const connectionLabel = useMemo(() => {
    if (status.source === "nodemcu" && status.online) {
      return "Connected to ESP controller";
    }

    if (status.source === "unconfigured") {
      return "Backend is not configured with the ESP IP";
    }

    if (status.source === "fallback") {
      return "ESP controller unavailable";
    }

    if (status.source === "offline") {
      return "Backend offline";
    }

    return "Waiting for controller state";
  }, [status.online, status.source]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Motor Dashboard</span>
          <h1>Speed control for your NodeMCU-powered motor.</h1>
          <p>
            Monitor the current speed, set the target speed, and push updates to the motor controller
            from one interface.
          </p>
        </div>

        <div className="status-strip">
          <div className="status-pill">
            <span className={`status-dot${status.online ? " is-live" : ""}`} />
            {connectionLabel}
          </div>
          <div className="status-pill">
            Last update {status.updatedAt ? new Date(status.updatedAt).toLocaleTimeString() : "--:--:--"}
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel primary-panel">
          <div className="panel-heading">
            <h2>Set speed</h2>
            <button className="primary-button" disabled={saving} onClick={applySpeed}>
              {saving ? "Sending..." : "Apply"}
            </button>
          </div>

          <SpeedKnob
            value={speedDraft}
            maxSpeed={status.maxSpeed || 100}
            onChange={setSpeedDraft}
            disabled={saving}
          />

          <div className="scale-row">
            <span>0</span>
            <span>{Math.round((status.maxSpeed || 100) / 2)}</span>
            <span>{status.maxSpeed || 100}</span>
          </div>
        </article>

        <article className="panel metrics-panel">
          <h2>Live metrics</h2>
          <div className="metric-card">
            <span className="metric-label">Current speed</span>
            <strong>{status.currentSpeed}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Target speed</span>
            <strong>{status.targetSpeed}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Mode</span>
            <strong>{status.source}</strong>
          </div>
          {error ? <p className="error-box">{error}</p> : null}
        </article>
      </section>
    </main>
  );
}
