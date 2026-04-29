# ESP32 BLDC ESC PlatformIO Example

This project contains a minimal PlatformIO example to run a BLDC motor through an ESC using an ESP32.

## Files

- `platformio.ini`
- `src/main.cpp`
- `ESP32_BLDC_ESC_Control.ino` (older Wi-Fi HTTP example kept as reference)

## What the simple example does

- configures `GPIO 18` as the ESC signal output
- sends a `50 Hz` servo-style PWM signal
- holds minimum throttle for arming
- runs the motor at a fixed throttle percentage

## Wiring

- `ESP32 GND` -> `ESC GND`
- `ESP32 GPIO 18` -> `ESC signal`
- `ESC power` -> battery
- `BLDC motor` -> ESC motor wires

Do not power the motor from the ESP32.

## Change these values in `src/main.cpp`

- `ESC_PIN`
- `MOTOR_SPEED_PERCENT`
- `ESC_ARM_TIME_MS` if your ESC needs more arming time

## Build and upload

```bash
pio run
pio run --target upload
pio device monitor
```

## Safety

- Start with low throttle like `10` to `15`
- Keep the propeller/load removed for the first test
- Power the ESC separately and make sure grounds are shared
