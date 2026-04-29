#include <Arduino.h>

constexpr int ESC_PIN = 18;
constexpr int PWM_CHANNEL = 0;
constexpr int PWM_FREQUENCY = 50;
constexpr int PWM_RESOLUTION = 16;

constexpr int ESC_MIN_PULSE_US = 1000;
constexpr int ESC_MAX_PULSE_US = 2000;
constexpr int MOTOR_SPEED_PERCENT = 15;
constexpr unsigned long ESC_ARM_TIME_MS = 4000;
constexpr unsigned long MOTOR_RUN_TIME_MS = 5000;

uint32_t pulseUsToDuty(int pulseUs) {
  const uint32_t maxDuty = (1u << PWM_RESOLUTION) - 1;
  const float periodUs = 1000000.0f / PWM_FREQUENCY;
  return static_cast<uint32_t>((pulseUs / periodUs) * maxDuty);
}

int speedPercentToPulseUs(int speedPercent) {
  return map(speedPercent, 0, 100, ESC_MIN_PULSE_US, ESC_MAX_PULSE_US);
}

void writeEscPulseUs(int pulseUs) {
  ledcWrite(PWM_CHANNEL, pulseUsToDuty(pulseUs));
}

void writeEscSpeedPercent(int speedPercent) {
  writeEscPulseUs(speedPercentToPulseUs(speedPercent));
}

void armEsc() {
  Serial.println("Arming ESC at minimum throttle...");
  writeEscPulseUs(ESC_MIN_PULSE_US);
  delay(ESC_ARM_TIME_MS);
}

void stopMotor() {
  writeEscPulseUs(ESC_MIN_PULSE_US);
  Serial.println("Motor stopped.");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  ledcSetup(PWM_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttachPin(ESC_PIN, PWM_CHANNEL);

  armEsc();

  Serial.print("Spinning motor at ");
  Serial.print(MOTOR_SPEED_PERCENT);
  Serial.println("% throttle for 5 seconds...");
  writeEscSpeedPercent(MOTOR_SPEED_PERCENT);
  delay(MOTOR_RUN_TIME_MS);

  stopMotor();
}

void loop() {
  stopMotor();
  delay(100);
}
