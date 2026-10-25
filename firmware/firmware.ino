/*
  РІВНОХІД — живі дані акселерометра на сайт
  ------------------------------------------------------------
  Плата:   ESP32 Dev Module (ESP32 DevKit V1, CP2102)
  Датчик:  GY-521 (MPU6050) на I2C: SDA=GPIO21, SCL=GPIO22, адреса 0x68
  GPS:     GY-GPSV3-NEO, TX модуля -> GPIO35 (необов'язково, працює і без фіксу)
  Зв'язок: Wi-Fi (дім або точка доступу телефона) -> MQTT-брокер -> сайт (WebSocket)

  Перед прошивкою: скопіюй secrets.example.h у secrets.h і впиши Wi-Fi (лише 2.4 ГГц).
  Можна вказати кілька мереж: пристрій сам обере найсильнішу з відомих.

  Автономна робота: живлення від 18650 через MH-CD42 (OUT-5V -> VIN), USB не потрібен.
  Оновлення по Wi-Fi (OTA): Arduino IDE -> Tools -> Port -> мережевий порт "rivnohid".

  Бібліотеки (Arduino IDE -> Tools -> Manage Libraries):
    - PubSubClient (Nick O'Leary)
    - TinyGPSPlus (Mikal Hart)

  Що робить:
    1. Читає MPU6050 з частотою 200 Гц (діапазон ±8g).
    2. На старті 2 секунди калібрується: ТРИМАЙ ВІЗОК НЕРУХОМО.
       Визначає напрям гравітації, тож орієнтація датчика не важлива.
    3. Рахує вертикальне прискорення (струс відносно 1g).
    4. Кожні 100 мс відправляє пакет JSON: 20 відліків, RMS, пік, GPS, заряд.
    5. Пік > 0.6g = подія "яма". Кнопка 2 = ручна мітка "перешкода".

  RGB світлодіод: жовтий = підключення Wi-Fi/MQTT, зелений = дані йдуть,
                  синій спалах = яма, червоний = помилка датчика.
*/

#include <WiFi.h>
#include <ArduinoOTA.h>
#include <esp_sleep.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <TinyGPSPlus.h>

// ====== НАЛАШТУВАННЯ ======
// Wi-Fi задається у secrets.h (не комітиться). Скопіюй secrets.example.h -> secrets.h
#include "secrets.h"

const char* MQTT_HOST  = "broker.hivemq.com";
const int   MQTT_PORT  = 1883;
const char* MQTT_TOPIC = "rivnohid/rv7f3k/live";   // має збігатися з сайтом
const char* MQTT_STATUS = "rivnohid/rv7f3k/status"; // online / offline (retained)
// ==========================

// Піни (з документа збірки)
#define PIN_SDA     21
#define PIN_SCL     22
#define PIN_GPS_RX  35
#define PIN_BTN2    33   // перешкода
#define PIN_LED_R   13
#define PIN_LED_G    4
#define PIN_LED_B    2
#define PIN_BATT    34

uint8_t MPU_ADDR = 0x68;     // 0x69, якщо AD0 на 3.3V
#define SAMPLE_HZ   200
#define BATCH       20          // 20 відліків = 100 мс
#define BUMP_G      0.60f       // поріг ями
#define ACC_LSB     4096.0f     // ±8g
#define BATT_CUTOFF 3.30f       // нижче — сон, щоб не вбити акумулятор
#define WIFI_SCAN_EVERY_MS 20000

WiFiClient   net;
PubSubClient mqtt(net);
TinyGPSPlus  gps;

float gx0, gy0, gz0, gMag;      // вектор гравітації після калібрування
int16_t batchBuf[BATCH];        // вертикальне прискорення, мілі-g
int   batchN = 0;
float sumSq = 0, peak = 0;
uint32_t seq = 0, nextSampleUs = 0, bumpLedUntil = 0, lastBumpMs = 0;
bool  sensorOk = false, markPending = false;
uint32_t badReads = 0;
bool  otaStarted = false, otaActive = false;
const size_t WIFI_COUNT = sizeof(WIFI_NETWORKS) / sizeof(WIFI_NETWORKS[0]);

// ---------- світлодіод ----------
void led(bool r, bool g, bool b) {
  digitalWrite(PIN_LED_R, r); digitalWrite(PIN_LED_G, g); digitalWrite(PIN_LED_B, b);
}

// ---------- MPU6050 без зовнішніх бібліотек ----------
void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR); Wire.write(reg); Wire.write(val); Wire.endTransmission();
}

void i2cScan() {
  Serial.print("I2C-сканер: ");
  int found = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { Serial.printf("0x%02X ", a); found++; }
  }
  Serial.println(found ? "" : "нічого не знайдено (перевір SDA=21, SCL=22, 3V3, GND)");
}

bool mpuInit() {
  const uint8_t cand[2] = {0x68, 0x69};
  bool ok = false;
  for (uint8_t c : cand) {
    Wire.beginTransmission(c);
    if (Wire.endTransmission() == 0) { MPU_ADDR = c; ok = true; break; }
  }
  if (!ok) return false;
  Serial.printf("MPU6050 знайдено на 0x%02X\n", MPU_ADDR);
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x75); Wire.endTransmission(true);
  Wire.requestFrom(MPU_ADDR, (uint8_t)1);
  Serial.printf("WHO_AM_I = 0x%02X (очікується 0x68, 0x70 або 0x72)\n", Wire.available() ? Wire.read() : 0xFF);
  mpuWrite(0x6B, 0x01);   // прокинутись, тактування від гіроскопа X
  delay(50);
  mpuWrite(0x1A, 0x02);   // DLPF ~94 Гц
  mpuWrite(0x19, 0x04);   // 1 кГц / (1+4) = 200 Гц
  mpuWrite(0x1C, 0x10);   // акселерометр ±8g
  mpuWrite(0x1B, 0x08);   // гіроскоп ±500°/с (не використовуємо, але налаштовано)
  return true;
}

bool mpuRead(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x3B);
  uint8_t e = Wire.endTransmission(true);
  uint8_t got = Wire.requestFrom(MPU_ADDR, (uint8_t)6);
  if (got != 6) {
    static uint32_t lastErr = 0;
    if (millis() - lastErr > 1000) { lastErr = millis(); Serial.printf("I2C читання: endTx=%u, отримано %u з 6 байт\n", e, got); }
    while (Wire.available()) Wire.read();
    return false;
  }
  int16_t x = (Wire.read() << 8) | Wire.read();
  int16_t y = (Wire.read() << 8) | Wire.read();
  int16_t z = (Wire.read() << 8) | Wire.read();
  ax = x / ACC_LSB; ay = y / ACC_LSB; az = z / ACC_LSB;
  // Відкидаємо биті відліки: насичення або нереальна величина
  if (abs(x) >= 32767 || abs(y) >= 32767 || abs(z) >= 32767) return false;
  float m2 = ax * ax + ay * ay + az * az;
  if (m2 > 49.0f) return false;              // > 7 g — для візка нереально, це збій шини
  return true;
}

void calibrate() {
  Serial.println("Калібрування 2 с: не рухай пристрій...");
  double sx = 0, sy = 0, sz = 0; int n = 0;
  uint32_t t0 = millis();
  while (millis() - t0 < 2000) {
    float ax, ay, az;
    if (mpuRead(ax, ay, az)) {
      float m = sqrtf(ax * ax + ay * ay + az * az);
      if (m > 0.8f && m < 1.2f) { sx += ax; sy += ay; sz += az; n++; }
    }
    led((millis() / 150) % 2, (millis() / 150) % 2, 0);   // жовте блимання
    delay(5);
  }
  if (n < 50) {
    Serial.printf("Калібрування не вдалося: прочитано лише %d відліків\n", n);
    sensorOk = false; return;
  }
  gx0 = sx / n; gy0 = sy / n; gz0 = sz / n;
  gMag = sqrtf(gx0 * gx0 + gy0 * gy0 + gz0 * gz0);
  Serial.printf("Калібрування OK (%d відліків). Гравітація: %.3f %.3f %.3f  |g|=%.3f\n", n, gx0, gy0, gz0, gMag);
}

// ---------- мережа ----------
// Сканує ефір і підключається до найсильнішої відомої мережі. Повертає true, якщо почав підключення.
bool connectBestKnown() {
  WiFi.disconnect();
  delay(50);
  int n = WiFi.scanNetworks();
  int best = -1, bestRssi = -1000, bestIdx = -1;
  for (int i = 0; i < n; i++) {
    for (size_t k = 0; k < WIFI_COUNT; k++) {
      if (WiFi.SSID(i) == WIFI_NETWORKS[k].ssid && WiFi.RSSI(i) > bestRssi) {
        best = (int)k; bestRssi = WiFi.RSSI(i); bestIdx = i;
      }
    }
  }
  if (best < 0) {
    Serial.printf("Wi-Fi: жодної відомої мережі поруч (бачу %d). Вимірювання тривають.\n", n);
    for (int i = 0; i < n && i < 8; i++)
      Serial.printf("  [%s]  %d dBm\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
    WiFi.scanDelete();
    return false;
  }
  Serial.printf("Wi-Fi: підключаюсь до [%s] (%d dBm, канал %d)\n",
                WIFI_NETWORKS[best].ssid, bestRssi, WiFi.channel(bestIdx));
  WiFi.scanDelete();
  WiFi.begin(WIFI_NETWORKS[best].ssid, WIFI_NETWORKS[best].pass);
  // Менше стрибків струму від радіо = стабільніше живлення датчика
  WiFi.setSleep(false);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);
  return true;
}

void startOta() {
  if (otaStarted) return;
  ArduinoOTA.setHostname("rivnohid");
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.onStart([]() { otaActive = true; Serial.println("OTA: оновлення почалось"); led(0, 0, 1); });
  ArduinoOTA.onEnd([]() { Serial.println("\nOTA: готово, перезапуск"); });
  ArduinoOTA.onProgress([](unsigned int done, unsigned int total) {
    static uint8_t last = 255; uint8_t pct = done * 100 / total;
    if (pct / 10 != last) { last = pct / 10; Serial.printf("OTA: %u%%\n", pct); led(0, 0, pct % 20 < 10); }
  });
  ArduinoOTA.onError([](ota_error_t e) { otaActive = false; Serial.printf("OTA: помилка %u\n", e); });
  ArduinoOTA.begin();
  otaStarted = true;
  Serial.printf("OTA готова: мережевий порт \"rivnohid\" (%s)\n", WiFi.localIP().toString().c_str());
}

// Перше підключення на старті (чекає до 15 с)
void ensureWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  if (!connectBestKnown()) return;
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
    led(1, 1, 0); delay(250); led(0, 0, 0); delay(250); Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " OK" : " не вдалося");
  if (WiFi.status() == WL_CONNECTED) { Serial.println(WiFi.localIP()); startOta(); }
}

void ensureMqtt() {
  if (mqtt.connected() || WiFi.status() != WL_CONNECTED) return;
  static uint32_t lastTry = 0;
  if (millis() - lastTry < 2000) return;
  lastTry = millis();
  String id = "rivnohid-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.print("MQTT: підключаюсь... ");
  // LWT: якщо пристрій зникне, брокер сам опублікує "offline"
  if (mqtt.connect(id.c_str(), MQTT_STATUS, 0, true, "offline")) {
    mqtt.publish(MQTT_STATUS, "online", true);
    Serial.println("OK");
  }
  else Serial.printf("помилка %d\n", mqtt.state());
}

float batteryV() {
  return analogRead(PIN_BATT) / 4095.0f * 3.3f * 2.0f;   // калібрувати мультиметром
}

// Захист 18650: якщо напруга < 3.3 В протягом 10 с — повідомити і заснути.
// Нижче 2.5 В вважаємо, що дільник не підключений, і нічого не робимо.
void checkBattery() {
  static uint32_t lowSince = 0, lastCheck = 0;
  if (millis() - lastCheck < 1000) return;
  lastCheck = millis();
  float v = batteryV();
  if (v < 2.5f || v >= BATT_CUTOFF) { lowSince = 0; return; }
  if (!lowSince) lowSince = millis();
  if (millis() - lowSince > 10000) {
    Serial.printf("Акумулятор %.2f В — засинаю, щоб його не пошкодити. Заряди й перезапусти.\n", v);
    if (mqtt.connected()) { mqtt.publish(MQTT_STATUS, "low_battery", true); mqtt.loop(); delay(200); }
    for (int i = 0; i < 6; i++) { led(1, 0, 0); delay(150); led(0, 0, 0); delay(150); }
    esp_deep_sleep_start();
  }
}

// ---------- відправка пакета ----------
void sendBatch() {
  float rms = sqrtf(sumSq / BATCH);
  bool bump = (peak >= BUMP_G) && (millis() - lastBumpMs > 700);
  if (bump) { lastBumpMs = millis(); bumpLedUntil = millis() + 200; }

  static char buf[900];
  int p = snprintf(buf, sizeof(buf), "{\"seq\":%lu,\"t\":%lu,\"hz\":%d,\"a\":[",
                   (unsigned long)seq++, (unsigned long)millis(), SAMPLE_HZ);
  for (int i = 0; i < BATCH; i++)
    p += snprintf(buf + p, sizeof(buf) - p, i ? ",%d" : "%d", batchBuf[i]);
  p += snprintf(buf + p, sizeof(buf) - p, "],\"rms\":%.3f,\"pk\":%.3f,\"bump\":%d,\"mark\":%d,\"bat\":%.2f",
                rms, peak, bump ? 1 : 0, markPending ? 1 : 0, batteryV());
  if (gps.location.isValid() && gps.location.age() < 3000)
    p += snprintf(buf + p, sizeof(buf) - p, ",\"lat\":%.6f,\"lon\":%.6f,\"spd\":%.1f,\"sat\":%d",
                  gps.location.lat(), gps.location.lng(), gps.speed.kmph(), (int)gps.satellites.value());
  else
    p += snprintf(buf + p, sizeof(buf) - p, ",\"sat\":%d", (int)gps.satellites.value());
  snprintf(buf + p, sizeof(buf) - p, "}");

  if (mqtt.connected()) mqtt.publish(MQTT_TOPIC, buf);
  markPending = false;

  // Короткий рядок у монітор порту (115200) для перевірки без сайту
  static uint8_t k = 0;
  if (++k % 10 == 0) { Serial.printf("rms=%.3fg pk=%.3fg mqtt=%d sat=%d bad=%lu\n", rms, peak, mqtt.connected(), (int)gps.satellites.value(), (unsigned long)badReads); badReads = 0; }

  batchN = 0; sumSq = 0; peak = 0;
}

void setup() {
  Serial.begin(115200);
  delay(1500);   // щоб монітор порту встиг підключитися після прошивки
  Serial.println("\n=== РІВНОХІД live ===");
  pinMode(PIN_LED_R, OUTPUT); pinMode(PIN_LED_G, OUTPUT); pinMode(PIN_LED_B, OUTPUT);
  pinMode(PIN_BTN2, INPUT_PULLUP);
  led(1, 1, 0);

  // Спершу Wi-Fi: його старт дає стрибок струму, який збиває I2C
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(15);
  ensureWifi();
  ensureMqtt();

  Wire.begin(PIN_SDA, PIN_SCL, 100000);
  Wire.setTimeOut(50);
  i2cScan();
  sensorOk = mpuInit();
  if (sensorOk) calibrate();
  else Serial.println("MPU6050 не знайдено (ні 0x68, ні 0x69). Пробую знову кожні 3 с...");

  Serial1.begin(9600, SERIAL_8N1, PIN_GPS_RX, -1);

  nextSampleUs = micros();
}

void loop() {
  // Оновлення по Wi-Fi: під час прошивки нічого іншого не робимо
  if (otaStarted) ArduinoOTA.handle();
  if (otaActive) return;

  checkBattery();

  // GPS — читаємо все, що прийшло
  while (Serial1.available()) gps.encode(Serial1.read());

  // Кнопка 2 — ручна мітка "перешкода"
  static bool lastBtn = HIGH; static uint32_t btnMs = 0;
  bool b = digitalRead(PIN_BTN2);
  if (b == LOW && lastBtn == HIGH && millis() - btnMs > 300) { markPending = true; btnMs = millis(); }
  lastBtn = b;

  // Датчик не знайдено: повторна спроба, червоне блимання
  if (!sensorOk) {
    static uint32_t lastTry = 0;
    if (millis() - lastTry > 3000) {
      lastTry = millis();
      i2cScan();
      if (mpuInit()) { sensorOk = true; calibrate(); nextSampleUs = micros(); }
    }
  }

  // Рівно 200 Гц
  if (sensorOk && (int32_t)(micros() - nextSampleUs) >= 0) {
    nextSampleUs += 1000000UL / SAMPLE_HZ;
    float ax, ay, az;
    static uint8_t failRun = 0;
    bool okRead = mpuRead(ax, ay, az);
    if (!okRead) badReads++;
    if (!okRead && ++failRun >= 10) {
      failRun = 0;
      Serial.println("MPU6050: збій шини, переналаштовую...");
      Wire.end(); delay(5); Wire.begin(PIN_SDA, PIN_SCL, 100000); Wire.setTimeOut(50);
      mpuInit();
    }
    if (okRead) {
      failRun = 0;
      // проєкція на напрям гравітації мінус 1g = вертикальний струс
      float av = (ax * gx0 + ay * gy0 + az * gz0) / gMag - gMag;
      batchBuf[batchN++] = (int16_t)lroundf(av * 1000.0f);
      sumSq += av * av;
      if (fabsf(av) > peak) peak = fabsf(av);
      if (batchN >= BATCH) sendBatch();
    }
  }

  // Раз на секунду перевіряємо, чи MPU не скинув налаштування (ACCEL_CONFIG має бути 0x10)
  static uint32_t lastCfg = 0;
  if (sensorOk && millis() - lastCfg > 1000) {
    lastCfg = millis();
    Wire.beginTransmission(MPU_ADDR); Wire.write(0x1C); Wire.endTransmission(true);
    if (Wire.requestFrom(MPU_ADDR, (uint8_t)1) == 1) {
      uint8_t cfg = Wire.read();
      if (cfg != 0x10) { Serial.printf("MPU6050 скинув налаштування (0x%02X), відновлюю\n", cfg); mpuInit(); }
    }
  }

  // Мережа (не блокує вимірювання надовго)
  static uint32_t lastNet = 0;
  static uint32_t lastWifiTry = 0;
  if (millis() - lastNet > 1000) {
    lastNet = millis();
    // Втратили мережу (пішли з дому) — шукаємо іншу відому, напр. точку доступу телефона
    if (WiFi.status() != WL_CONNECTED && millis() - lastWifiTry > WIFI_SCAN_EVERY_MS) {
      lastWifiTry = millis();
      connectBestKnown();
    }
    if (WiFi.status() == WL_CONNECTED) startOta();
    ensureMqtt();
  }
  mqtt.loop();

  // Світлодіод стану
  if (!sensorOk)                  led((millis() / 300) % 2, 0, 0);
  else if (millis() < bumpLedUntil) led(0, 0, 1);
  else if (mqtt.connected())      led(0, 1, 0);
  else                            led(1, 1, 0);
}
