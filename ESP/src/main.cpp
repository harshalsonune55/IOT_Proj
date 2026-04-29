#include <WiFi.h>
#include <WebServer.h>

// Wi-Fi credentials
const char* WIFI_SSID = "Galaxy A26 5G C8D9";
const char* WIFI_PASSWORD = "8v5zihcicyinwzx";

// ESC signal configuration
constexpr int ESC_SIGNAL_PIN = 18;
constexpr int ESC_PWM_CHANNEL = 0;
constexpr int ESC_PWM_FREQUENCY = 50;
constexpr int ESC_PWM_RESOLUTION = 16;
constexpr int ESC_MIN_PULSE_US = 1000;
constexpr int ESC_MAX_PULSE_US = 2000;

// Speed configuration used by the backend/frontend
constexpr int SPEED_MIN = 0;
constexpr int SPEED_MAX = 100;

WebServer server(80);

int targetSpeed = 0;
int currentSpeed = 0;
unsigned long lastSpeedUpdateMs = 0;

const char* methodToString(HTTPMethod method) {
  switch (method) {
    case HTTP_GET:
      return "GET";
    case HTTP_POST:
      return "POST";
    case HTTP_PUT:
      return "PUT";
    case HTTP_PATCH:
      return "PATCH";
    case HTTP_DELETE:
      return "DELETE";
    case HTTP_OPTIONS:
      return "OPTIONS";
    default:
      return "OTHER";
  }
}

void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

String getRequestBody() {
  if (server.hasArg("plain")) {
    return server.arg("plain");
  }

  return "";
}

int clampSpeed(int speed) {
  if (speed < SPEED_MIN) {
    return SPEED_MIN;
  }

  if (speed > SPEED_MAX) {
    return SPEED_MAX;
  }

  return speed;
}

int mapSpeedToPulseUs(int speedPercent) {
  return map(speedPercent, SPEED_MIN, SPEED_MAX, ESC_MIN_PULSE_US, ESC_MAX_PULSE_US);
}

uint32_t pulseUsToDuty(int pulseUs) {
  const uint32_t maxDuty = (1 << ESC_PWM_RESOLUTION) - 1;
  const float periodUs = 1000000.0f / ESC_PWM_FREQUENCY;
  const float dutyRatio = pulseUs / periodUs;

  return static_cast<uint32_t>(dutyRatio * maxDuty);
}

void writeEscSpeed(int speedPercent) {
  const int pulseUs = mapSpeedToPulseUs(speedPercent);
  const uint32_t duty = pulseUsToDuty(pulseUs);

  ledcWrite(ESC_PWM_CHANNEL, duty);

  Serial.print("ESC speed set to ");
  Serial.print(speedPercent);
  Serial.print("% (");
  Serial.print(pulseUs);
  Serial.println("us)");
}

int parseSpeedValue(const String& value) {
  if (value.length() == 0) {
    return SPEED_MIN;
  }

  return clampSpeed(value.toInt());
}

int parseSpeedFromJson(const String& body) {
  const String key = "\"speed\"";
  const int keyIndex = body.indexOf(key);

  if (keyIndex < 0) {
    return -1;
  }

  const int colonIndex = body.indexOf(':', keyIndex + key.length());

  if (colonIndex < 0) {
    return -1;
  }

  int start = colonIndex + 1;

  while (start < body.length() && isspace(body[start])) {
    start++;
  }

  int end = start;

  while (end < body.length() && (isdigit(body[end]) || body[end] == '-')) {
    end++;
  }

  return parseSpeedValue(body.substring(start, end));
}

int parseRequestedSpeed() {
  if (server.hasArg("speed")) {
    return parseSpeedValue(server.arg("speed"));
  }

  const String body = getRequestBody();
  const int parsedFromJson = parseSpeedFromJson(body);

  if (parsedFromJson >= 0) {
    return parsedFromJson;
  }

  if (server.hasArg("plain")) {
    return parseSpeedValue(server.arg("plain"));
  }

  return SPEED_MIN;
}

void sendJsonStatus() {
  const bool online = WiFi.status() == WL_CONNECTED;
  String response = "{";
  response += "\"currentSpeed\":" + String(currentSpeed) + ",";
  response += "\"targetSpeed\":" + String(targetSpeed) + ",";
  response += "\"online\":" + String(online ? "true" : "false") + ",";
  response += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  response += "\"uptimeMs\":" + String(millis());
  response += "}";

  sendCorsHeaders();
  server.send(200, "application/json", response);
}

void handleRoot() {
  String response = "ESP32 BLDC ESC controller is running.\n";
  response += "GET /motor/status\n";
  response += "GET or POST /motor/speed\n";
  response += "Examples:\n";
  response += "  /motor/speed?speed=50\n";
  response += "  POST JSON: {\"speed\": 50}\n";
  sendCorsHeaders();
  server.send(200, "text/plain", response);
}

void handleMotorStatus() {
  sendJsonStatus();
}

void handleMotorSpeed() {
  const int nextSpeed = parseRequestedSpeed();

  Serial.print("Received motor speed command: ");
  Serial.println(nextSpeed);

  targetSpeed = nextSpeed;
  currentSpeed = nextSpeed;
  lastSpeedUpdateMs = millis();
  writeEscSpeed(targetSpeed);

  sendJsonStatus();
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204);
}

void handleFavicon() {
  server.send(204);
}

void handleNotFound() {
  const String uri = server.uri();
  const char* method = methodToString(server.method());

  Serial.print("Unhandled request: ");
  Serial.print(method);
  Serial.print(" ");
  Serial.println(uri);

  String response = "{";
  response += "\"error\":\"Not found\",";
  response += "\"method\":\"" + String(method) + "\",";
  response += "\"uri\":\"" + uri + "\"";
  response += "}";

  sendCorsHeaders();
  server.send(404, "application/json", response);
}

void connectToWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected. ESP32 IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection failed. Rebooting in 5 seconds.");
    delay(5000);
    ESP.restart();
  }
}

void armEsc() {
  targetSpeed = 0;
  currentSpeed = 0;
  writeEscSpeed(0);

  Serial.println("Arming ESC at minimum throttle. Wait for ESC tones.");
  delay(4000);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  ledcSetup(ESC_PWM_CHANNEL, ESC_PWM_FREQUENCY, ESC_PWM_RESOLUTION);
  ledcAttachPin(ESC_SIGNAL_PIN, ESC_PWM_CHANNEL);

  armEsc();
  connectToWifi();

  server.on("/", HTTP_GET, handleRoot);
  server.on("/motor/status", HTTP_GET, handleMotorStatus);
  server.on("/motor/speed", HTTP_GET, handleMotorSpeed);
  server.on("/motor/speed", HTTP_POST, handleMotorSpeed);
  server.on("/favicon.ico", HTTP_GET, handleFavicon);
  server.on("/motor/status", HTTP_OPTIONS, handleOptions);
  server.on("/motor/speed", HTTP_OPTIONS, handleOptions);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.println("HTTP server started.");
}

void loop() {
  server.handleClient();

  // Without an RPM sensor, current speed is the commanded speed.
  // Replace this with measured RPM logic if you add a hall sensor or encoder.
  currentSpeed = targetSpeed;

  if (millis() - lastSpeedUpdateMs > 30000 && targetSpeed != 0) {
    Serial.println("No update for 30 seconds. Returning ESC to minimum throttle.");
    targetSpeed = 0;
    currentSpeed = 0;
    writeEscSpeed(0);
    lastSpeedUpdateMs = millis();
  }
}
