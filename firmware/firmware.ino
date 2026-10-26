/*
  РІВНОХІД v2: акселерометр наживо, голосові нотатки, стан доріг на карті, SOS
  ---------------------------------------------------------------------------
  Плата:  ESP32 Dev Module (ESP32 DevKit V1)

  Підключення (див. docs у проєкті):
    I2C  SDA=21 SCL=22   MPU6050 (0x68), OLED SSD1306 128x32 (0x3C), BH1750 (0x23)
    SD   CS=5 SCK=18 MOSI=23 MISO=19
    Мікрофон INMP441  SCK=26 WS=25 SD=39 (L/R на GND)
    GPS  TX модуля -> 35
    SIM800L (необов'язково) TXD->16, RXD<-17
    Кнопки (другий вивід на GND): 1=32 запис голосу, 2=33 стоп мікрофона,
                                  3=14 стан доріг на карті вкл/викл, 4=15 SOS (утримати 2 с)
    RGB світлодіод R=13 G=4 B=2, дільник акумулятора -> 34

  Бібліотеки (Library Manager): PubSubClient, TinyGPSPlus, U8g2
  Налаштування: firmware/secrets.h (див. secrets.example.h)

  Куди йдуть дані:
    * акселерометр 200 Гц  -> MQTT rivnohid/rv7f3k/live   -> сторінка /live
    * стан пристрою         -> MQTT rivnohid/rv7f3k/status (retained)
    * події (запис, SOS...) -> MQTT rivnohid/rv7f3k/event
    * голос, позначки, SOS  -> Supabase (RPC device_*)     -> карта сайту
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoOTA.h>
#include <Preferences.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <PubSubClient.h>
#include <TinyGPSPlus.h>
#include <U8g2lib.h>
#include <ESP_I2S.h>          // новий драйвер I2S (core 3.x); старий driver/i2s.h конфліктує з analogRead
#include <freertos/stream_buffer.h>
#include <esp_sleep.h>

#include "secrets.h"

// ---------------- MQTT ----------------
const char* MQTT_HOST   = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* MQTT_TOPIC  = "rivnohid/rv7f3k/live";
const char* MQTT_STATUS = "rivnohid/rv7f3k/status";
const char* MQTT_EVENT  = "rivnohid/rv7f3k/event";
const char* MQTT_DIAG   = "rivnohid/rv7f3k/diag";     // що підключено (retained)
#define FW_VERSION "2.1"

// ---------------- Піни ----------------
#define PIN_SDA      21
#define PIN_SCL      22
#define PIN_SD_CS     5
#define PIN_GPS_RX   35
#define PIN_GSM_RX   16
#define PIN_GSM_TX   17
#define PIN_I2S_BCLK 26
#define PIN_I2S_WS   25
#define PIN_I2S_DIN  39
#define PIN_BTN1     32
#define PIN_BTN2     33
#define PIN_BTN3     14
#define PIN_BTN4     15
#define PIN_LED_R    13
#define PIN_LED_G     4
#define PIN_LED_B     2
#define PIN_BATT     34

// ---------------- Параметри ----------------
#define SAMPLE_HZ        200
#define BATCH            20          // 20 відліків = 100 мс на пакет
#define BUMP_G           0.60f
#define ACC_LSB          4096.0f     // ±8g
#define BATT_CUTOFF      3.30f
#define WIFI_SCAN_EVERY  20000
#define REC_RATE_IN      16000       // частота мікрофона
#define REC_RATE_OUT     8000        // частота у файлі (голос, менше трафіку)
#define REC_MAX_MS       60000       // максимум 60 с на нотатку
#define ROAD_WINDOW_MS   10000       // кнопка 3: позначка раз на 10 с
#define ROAD_MIN_MOVE_M  10.0        // ...якщо візок проїхав хоча б 10 м
#define SOS_HOLD_MS      2000
#define HELLO_EVERY_MS   600000      // оновлювати номер SOS з сайту раз на 10 хв
#define MIC_SHIFT        12          // підсилення мікрофона: менше число = гучніше

// ---------------- Об'єкти ----------------
WiFiClient   net;
PubSubClient mqtt(net);
TinyGPSPlus  gps;
Preferences  prefs;
U8G2_SSD1306_128X32_UNIVISION_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);
I2SClass     mic;

const size_t WIFI_COUNT = sizeof(WIFI_NETWORKS) / sizeof(WIFI_NETWORKS[0]);

// ---------------- Стан ----------------
uint8_t  MPU_ADDR = 0x68;
bool     sensorOk = false, oledOk = false, sdOk = false, gsmOk = false, micOk = false;
bool     otaStarted = false, otaActive = false;
float    gx0, gy0, gz0, gMag;
int16_t  batchBuf[BATCH];
int      batchN = 0;
float    sumSq = 0, peak = 0;
uint32_t seq = 0, bumpLedUntil = 0, lastBumpMs = 0, lastGoodRead = 0, badReads = 0;
float    lastRms = 0;
String   publishedState = "";
bool     diagDirty = true;      // треба (пере)опублікувати діагностику

// Кнопка 3: стан доріг на карті
bool     roadMode = false;
uint32_t roadWinStart = 0;
double   roadSumSq = 0; uint32_t roadN = 0; float roadPeak = 0;
double   roadLastLat = 0, roadLastLon = 0; bool roadHasLast = false;
uint32_t roadMarks = 0;

// Голос
volatile bool recording = false;
File     recFile;
uint32_t recStart = 0, recSamples = 0;
double   recLat = NAN, recLon = NAN;
char     recPath[32];
int32_t  recDc = 0;
int8_t   micSlot = I2S_STD_SLOT_LEFT;
// Мікрофон читає окрема задача і складає відліки (8 кГц, 16 біт) у буфер,
// а loop() переписує їх на SD. Так екран, мережа й SD не гублять звук.
StreamBufferHandle_t recBuf;
volatile bool recActive = false, recTaskIdle = true;
SemaphoreHandle_t sdMutex;

// SOS
char     sosPhone[24] = "";
char     sosName[32]  = "";
SemaphoreHandle_t sosMutex;
uint32_t sosShownUntil = 0;
bool     sosCalling = false;

// Екран: тимчасове повідомлення
String   toast1, toast2;
uint32_t toastUntil = 0;

// ---------------- Задачі мережі (окреме ядро) ----------------
enum JobType : uint8_t { JOB_HELLO, JOB_MARKER, JOB_VOICE, JOB_SOS };
struct Job {
  JobType type;
  double  lat, lon;
  int32_t durMs;
  char    sev[8];
  char    path[32];
  char    desc[48];
  bool    called;
};
enum ResType : uint8_t { RES_VOICE_OK, RES_VOICE_FAIL, RES_MARKER_OK, RES_MARKER_FAIL, RES_SOS_OK, RES_SOS_FAIL, RES_HELLO_OK, RES_HELLO_FAIL };
struct Result { ResType type; char id[40]; double lat, lon; int32_t durMs; };
QueueHandle_t jobQ, resQ;
int voiceInFlight = 0;          // скільки нотаток зараз у черзі/надсилаються

void recStopNote();

// =====================================================================
//                              Дрібниці
// =====================================================================
void led(bool r, bool g, bool b) {
  digitalWrite(PIN_LED_R, r); digitalWrite(PIN_LED_G, g); digitalWrite(PIN_LED_B, b);
}

void toast(const String& a, const String& b = "", uint32_t ms = 2500) {
  toast1 = a; toast2 = b; toastUntil = millis() + ms;
  Serial.printf("[екран] %s | %s\n", a.c_str(), b.c_str());
}

bool gpsFix() { return gps.location.isValid() && gps.location.age() < 3000; }

float batteryV() { return analogRead(PIN_BATT) / 4095.0f * 3.3f * 2.0f; }

void mqttEvent(const char* json) {
  if (mqtt.connected()) mqtt.publish(MQTT_EVENT, json);
}

String fmtCoord(double v) { return isnan(v) ? String("null") : String(v, 6); }

// =====================================================================
//                       MPU6050 (через апаратний FIFO)
// FIFO тримає до 170 відліків, тож екран і SD можуть займати шину без втрат.
// =====================================================================
void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR); Wire.write(reg); Wire.write(val); Wire.endTransmission();
}
int mpuRead8(uint8_t reg) {
  Wire.beginTransmission(MPU_ADDR); Wire.write(reg);
  if (Wire.endTransmission(true) != 0) return -1;
  if (Wire.requestFrom(MPU_ADDR, (uint8_t)1) != 1) return -1;
  return Wire.read();
}
bool mpuReadDirect(float& ax, float& ay, float& az) {
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x3B); Wire.endTransmission(true);
  if (Wire.requestFrom(MPU_ADDR, (uint8_t)6) != 6) { while (Wire.available()) Wire.read(); return false; }
  int16_t x = (Wire.read() << 8) | Wire.read();
  int16_t y = (Wire.read() << 8) | Wire.read();
  int16_t z = (Wire.read() << 8) | Wire.read();
  ax = x / ACC_LSB; ay = y / ACC_LSB; az = z / ACC_LSB;
  return (ax * ax + ay * ay + az * az) < 49.0f;
}

void i2cScan() {
  Serial.print("I2C: ");
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) Serial.printf("0x%02X ", a);
  }
  Serial.println();
}

void mpuFifoReset() {
  mpuWrite(0x6A, 0x04);          // FIFO_RESET
  delay(2);
  mpuWrite(0x6A, 0x40);          // FIFO_EN
}

bool mpuInit() {
  const uint8_t cand[2] = {0x68, 0x69};
  bool ok = false;
  for (uint8_t c : cand) {
    Wire.beginTransmission(c);
    if (Wire.endTransmission() == 0) { MPU_ADDR = c; ok = true; break; }
  }
  if (!ok) return false;
  mpuWrite(0x6B, 0x01);          // прокинутись
  delay(50);
  mpuWrite(0x1A, 0x02);          // DLPF ~94 Гц
  mpuWrite(0x19, 0x04);          // 1 кГц / 5 = 200 Гц
  mpuWrite(0x1C, 0x10);          // ±8g
  mpuWrite(0x23, 0x08);          // у FIFO лише акселерометр (6 байт/відлік)
  mpuFifoReset();
  Serial.printf("MPU6050 на 0x%02X, WHO_AM_I=0x%02X\n", MPU_ADDR, mpuRead8(0x75));
  return true;
}

void calibrate() {
  Serial.println("Калібрування 2 с: не рухай пристрій...");
  double sx = 0, sy = 0, sz = 0; int n = 0;
  uint32_t t0 = millis();
  while (millis() - t0 < 2000) {
    float ax, ay, az;
    if (mpuReadDirect(ax, ay, az)) {
      float m = sqrtf(ax * ax + ay * ay + az * az);
      if (m > 0.8f && m < 1.2f) { sx += ax; sy += ay; sz += az; n++; }
    }
    led((millis() / 150) % 2, (millis() / 150) % 2, 0);
    delay(5);
  }
  if (n < 50) { Serial.printf("Калібрування не вдалося (%d відліків)\n", n); sensorOk = false; return; }
  gx0 = sx / n; gy0 = sy / n; gz0 = sz / n;
  gMag = sqrtf(gx0 * gx0 + gy0 * gy0 + gz0 * gz0);
  Serial.printf("Калібрування OK: |g|=%.3f\n", gMag);
  mpuFifoReset();
  lastGoodRead = millis();
}

void onSample(float av);

// Забрати все, що накопичилось у FIFO
void mpuDrainFifo() {
  int hi = mpuRead8(0x72), lo = mpuRead8(0x73);
  if (hi < 0 || lo < 0) { badReads++; return; }
  int count = (hi << 8) | lo;
  if (count >= 1008) { mpuFifoReset(); badReads++; return; }   // переповнення
  count -= count % 6;
  while (count > 0) {
    uint8_t chunk = count > 120 ? 120 : count;                  // буфер Wire = 128 байт
    Wire.beginTransmission(MPU_ADDR); Wire.write(0x74); Wire.endTransmission(true);
    if (Wire.requestFrom(MPU_ADDR, chunk) != chunk) { while (Wire.available()) Wire.read(); badReads++; mpuFifoReset(); return; }
    for (uint8_t i = 0; i < chunk; i += 6) {
      int16_t x = (Wire.read() << 8) | Wire.read();
      int16_t y = (Wire.read() << 8) | Wire.read();
      int16_t z = (Wire.read() << 8) | Wire.read();
      float ax = x / ACC_LSB, ay = y / ACC_LSB, az = z / ACC_LSB;
      if (ax * ax + ay * ay + az * az > 49.0f) { badReads++; continue; }
      lastGoodRead = millis();
      onSample((ax * gx0 + ay * gy0 + az * gz0) / gMag - gMag);
    }
    count -= chunk;
  }
}

// =====================================================================
//                               Мережа
// =====================================================================
bool connectBestKnown() {
  WiFi.disconnect();
  delay(50);
  int n = WiFi.scanNetworks();
  int best = -1, bestRssi = -1000, bestIdx = -1;
  for (int i = 0; i < n; i++)
    for (size_t k = 0; k < WIFI_COUNT; k++)
      if (WiFi.SSID(i).equalsIgnoreCase(WIFI_NETWORKS[k].ssid) && WiFi.RSSI(i) > bestRssi) {
        best = (int)k; bestRssi = WiFi.RSSI(i); bestIdx = i;
      }
  if (best < 0) {
    Serial.printf("Wi-Fi: відомих мереж немає (бачу %d)\n", n);
    WiFi.scanDelete();
    return false;
  }
  String ssid = WiFi.SSID(bestIdx);
  Serial.printf("Wi-Fi: %s (%d dBm)\n", ssid.c_str(), bestRssi);
  WiFi.scanDelete();
  WiFi.begin(ssid.c_str(), WIFI_NETWORKS[best].pass);
  WiFi.setSleep(false);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);
  return true;
}

void startOta() {
  if (otaStarted) return;
  ArduinoOTA.setHostname("rivnohid");
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.onStart([]() {
    otaActive = true;
    if (oledOk) { oled.clearBuffer(); oled.setCursor(0, 13); oled.print("Оновлення..."); oled.sendBuffer(); }
  });
  ArduinoOTA.onError([](ota_error_t e) { otaActive = false; Serial.printf("OTA помилка %u\n", e); });
  ArduinoOTA.begin();
  otaStarted = true;
  Serial.printf("OTA: порт rivnohid (%s)\n", WiFi.localIP().toString().c_str());
}

void ensureWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  if (!connectBestKnown()) return;
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) { led(1, 1, 0); delay(250); led(0, 0, 0); delay(250); }
  if (WiFi.status() == WL_CONNECTED) { Serial.println(WiFi.localIP()); startOta(); }
}

void ensureMqtt() {
  if (mqtt.connected() || WiFi.status() != WL_CONNECTED) return;
  static uint32_t lastTry = 0;
  if (millis() - lastTry < 3000) return;
  lastTry = millis();
  String id = "rivnohid-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  if (mqtt.connect(id.c_str(), MQTT_STATUS, 0, true, "offline")) { publishedState = ""; diagDirty = true; Serial.println("MQTT OK"); }
}

// Діагностика: що знайдено на старті, щоб бачити на сайті без монітора порту
void publishDiag() {
  if (!mqtt.connected() || !diagDirty) return;
  char phoneSet;
  xSemaphoreTake(sosMutex, portMAX_DELAY); phoneSet = sosPhone[0] ? 1 : 0; xSemaphoreGive(sosMutex);
  char js[256];
  snprintf(js, sizeof(js),
           "{\"fw\":\"%s\",\"sd\":%d,\"mic\":%d,\"oled\":%d,\"gsm\":%d,\"mpu\":%d,\"sos\":%d,\"ssid\":\"%s\",\"ip\":\"%s\"}",
           FW_VERSION, sdOk, micOk, oledOk, gsmOk, sensorOk, phoneSet,
           WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
  if (mqtt.publish(MQTT_DIAG, js, true)) diagDirty = false;
}

void publishState() {
  if (!mqtt.connected()) return;
  const char* st = !sensorOk ? "no_sensor" : (millis() - lastGoodRead > 2000) ? "sensor_error" : "online";
  if (publishedState == st) return;
  if (mqtt.publish(MQTT_STATUS, st, true)) publishedState = st;
}

// ---------- Supabase RPC ----------
// Тіло запиту: head + base64(файл) + tail, віддається шматками, без копії в RAM.
class B64Body : public Stream {
 public:
  B64Body(const String& head, File* f, const String& tail) : h(head), t(tail), file(f) {
    fileSize = f ? f->size() : 0;
    b64Len = 4 * ((fileSize + 2) / 3);
    total = h.length() + b64Len + t.length();
  }
  size_t total;
  int available() override { size_t r = total - pos; return r > 0x7fffffff ? 0x7fffffff : (int)r; }
  int read() override { char c; return readBytes(&c, 1) == 1 ? (uint8_t)c : -1; }
  int peek() override { return -1; }
  size_t write(uint8_t) override { return 0; }
  using Stream::readBytes;
  size_t readBytes(char* buf, size_t len) override {
    size_t n = 0;
    while (n < len && pos < total) {
      if (pos < h.length()) { buf[n++] = h[pos++]; continue; }
      if (pos < h.length() + b64Len) {
        if (outPos >= outLen) refill();
        if (outPos >= outLen) break;
        buf[n++] = out[outPos++]; pos++; continue;
      }
      buf[n++] = t[pos - h.length() - b64Len]; pos++;
    }
    return n;
  }
 private:
  String h, t;
  File* file;
  size_t fileSize = 0, b64Len = 0, pos = 0, outLen = 0, outPos = 0;
  char out[1024];
  void refill() {
    static const char* A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    uint8_t in[768];
    size_t got = file->read(in, sizeof(in));
    outLen = 0; outPos = 0;
    for (size_t i = 0; i < got; i += 3) {
      uint32_t v = in[i] << 16;
      if (i + 1 < got) v |= in[i + 1] << 8;
      if (i + 2 < got) v |= in[i + 2];
      out[outLen++] = A[(v >> 18) & 63];
      out[outLen++] = A[(v >> 12) & 63];
      out[outLen++] = i + 1 < got ? A[(v >> 6) & 63] : '=';
      out[outLen++] = i + 2 < got ? A[v & 63] : '=';
    }
  }
};

int rpc(const char* fn, Stream* body, size_t len, String& resp) {
  WiFiClientSecure cli;
  cli.setInsecure();                     // TODO: прикріпити кореневий сертифікат Supabase
  HTTPClient http;
  http.setTimeout(30000);
  if (!http.begin(cli, String("https://") + SUPABASE_HOST + "/rest/v1/rpc/" + fn)) return -1;
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  int code = http.sendRequest("POST", body, len);
  resp = http.getString();
  http.end();
  return code;
}

int rpcJson(const char* fn, const String& json, String& resp) {
  WiFiClientSecure cli;
  cli.setInsecure();
  HTTPClient http;
  http.setTimeout(20000);
  if (!http.begin(cli, String("https://") + SUPABASE_HOST + "/rest/v1/rpc/" + fn)) return -1;
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);
  resp = http.getString();
  http.end();
  return code;
}

String jsonStr(const String& s, const char* key) {
  String k = String("\"") + key + "\"";
  int i = s.indexOf(k); if (i < 0) return "";
  i = s.indexOf(':', i); if (i < 0) return "";
  while (++i < (int)s.length() && s[i] == ' ');
  if (i >= (int)s.length() || s[i] != '"') return "";
  int j = s.indexOf('"', i + 1);
  return j > i ? s.substring(i + 1, j) : "";
}

void sendResult(ResType t, const String& id = "", double lat = NAN, double lon = NAN, int32_t dur = 0) {
  Result r{}; r.type = t; strlcpy(r.id, id.c_str(), sizeof(r.id)); r.lat = lat; r.lon = lon; r.durMs = dur;
  xQueueSend(resQ, &r, 0);
}

void netTask(void*) {
  Job j;
  for (;;) {
    if (xQueueReceive(jobQ, &j, portMAX_DELAY) != pdTRUE) continue;
    while (WiFi.status() != WL_CONNECTED) vTaskDelay(pdMS_TO_TICKS(2000));   // чекаємо мережу
    String resp, tok = String("\"p_token\":\"") + DEVICE_TOKEN + "\"";
    int code = -1;

    if (j.type == JOB_HELLO) {
      code = rpcJson("device_hello", "{" + tok + "}", resp);
      if (code == 200) {
        String ph = jsonStr(resp, "sos_phone"), nm = jsonStr(resp, "sos_name");
        xSemaphoreTake(sosMutex, portMAX_DELAY);
        strlcpy(sosPhone, ph.c_str(), sizeof(sosPhone));
        strlcpy(sosName, nm.c_str(), sizeof(sosName));
        xSemaphoreGive(sosMutex);
        sendResult(RES_HELLO_OK);
      } else sendResult(RES_HELLO_FAIL);

    } else if (j.type == JOB_MARKER) {
      String js = "{" + tok + ",\"p_lat\":" + fmtCoord(j.lat) + ",\"p_lng\":" + fmtCoord(j.lon) +
                  ",\"p_severity\":\"" + j.sev + "\",\"p_description\":\"" + j.desc + "\"}";
      code = rpcJson("device_add_marker", js, resp);
      sendResult(code == 200 ? RES_MARKER_OK : RES_MARKER_FAIL, jsonStr("{\"x\":" + resp + "}", "x"), j.lat, j.lon);

    } else if (j.type == JOB_SOS) {
      String js = "{" + tok + ",\"p_lat\":" + fmtCoord(j.lat) + ",\"p_lng\":" + fmtCoord(j.lon) +
                  ",\"p_called\":" + (j.called ? "true" : "false") + "}";
      for (int attempt = 0; attempt < 5 && code != 200; attempt++) {
        code = rpcJson("device_sos", js, resp);
        if (code != 200) vTaskDelay(pdMS_TO_TICKS(3000));
      }
      sendResult(code == 200 ? RES_SOS_OK : RES_SOS_FAIL, "", j.lat, j.lon);

    } else if (j.type == JOB_VOICE) {
      while (recording) vTaskDelay(pdMS_TO_TICKS(500));   // не заважаємо новому запису
      xSemaphoreTake(sdMutex, portMAX_DELAY);           // SD не можна читати з двох задач одночасно
      File f = SD.open(j.path, FILE_READ);
      if (!f) { xSemaphoreGive(sdMutex); sendResult(RES_VOICE_FAIL); continue; }
      String head = "{" + tok + ",\"p_lat\":" + fmtCoord(j.lat) + ",\"p_lng\":" + fmtCoord(j.lon) +
                    ",\"p_duration_ms\":" + String(j.durMs) + ",\"p_sample_rate\":" + String(REC_RATE_OUT) +
                    ",\"p_audio_b64\":\"";
      B64Body body(head, &f, "\"}");
      Serial.printf("Надсилаю %s (%u байт)\n", j.path, (unsigned)f.size());
      code = rpc("device_add_voice_note", &body, body.total, resp);
      f.close();
      if (code == 200) { SD.remove(j.path); String meta = String(j.path); meta.replace(".wav", ".txt"); SD.remove(meta); }
      xSemaphoreGive(sdMutex);
      if (code == 200) {
        sendResult(RES_VOICE_OK, jsonStr("{\"x\":" + resp + "}", "x"), j.lat, j.lon, j.durMs);
      } else {
        Serial.printf("Голос не надіслано: %d %s\n", code, resp.c_str());
        sendResult(RES_VOICE_FAIL);
      }
    }
    if (code != 200 && j.type != JOB_VOICE) Serial.printf("RPC %d: %d %s\n", j.type, code, resp.c_str());
  }
}

void queueJob(const Job& j) {
  if (xQueueSend(jobQ, &j, 0) != pdTRUE) { Serial.println("Черга мережі повна"); return; }
  if (j.type == JOB_VOICE) voiceInFlight++;
}

// =====================================================================
//                                Голос
// =====================================================================
bool micStart() {
  mic.setPins(PIN_I2S_BCLK, PIN_I2S_WS, -1, PIN_I2S_DIN);
  mic.setTimeout(100);
  return mic.begin(I2S_MODE_STD, REC_RATE_IN, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO, micSlot);
}
void micStop() { mic.end(); }

// Перевірка мікрофона на старті: якщо лівий канал мовчить, пробуємо правий
void micProbe() {
  static int32_t buf[256];
  for (int attempt = 0; attempt < 2; attempt++) {
    if (!micStart()) { Serial.println("I2S не стартував"); return; }
    int32_t mx = 0;
    uint32_t t0 = millis();
    while (millis() - t0 < 300) {
      size_t got = mic.readBytes((char*)buf, sizeof(buf));
      for (size_t i = 0; i < got / 4; i++) { int32_t v = abs(buf[i] >> 16); if (v > mx) mx = v; }
    }
    micStop();
    Serial.printf("Мікрофон (%s): рівень %ld\n", micSlot == I2S_STD_SLOT_LEFT ? "лівий" : "правий", (long)mx);
    if (mx > 0) { micOk = true; return; }
    micSlot = micSlot == I2S_STD_SLOT_LEFT ? I2S_STD_SLOT_RIGHT : I2S_STD_SLOT_LEFT;
  }
  Serial.println("Мікрофон мовчить: перевір SCK=26, WS=25, SD=39, L/R на GND");
}

// Задача мікрофона: 16 кГц/32 біт -> 8 кГц/16 біт у recBuf
void micTask(void*) {
  static int32_t raw[256];
  static int16_t out[128];
  for (;;) {
    if (!recActive) { recTaskIdle = true; vTaskDelay(pdMS_TO_TICKS(5)); continue; }
    recTaskIdle = false;
    size_t got = mic.readBytes((char*)raw, sizeof(raw));
    size_t n = got / 4, m = 0;
    for (size_t i = 0; i + 1 < n; i += 2) {           // середнє пари = 8 кГц
      int32_t v = ((raw[i] >> MIC_SHIFT) + (raw[i + 1] >> MIC_SHIFT)) / 2;
      recDc += (v - recDc) / 64;                      // прибрати постійну складову
      v -= recDc;
      out[m++] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
    }
    if (m) xStreamBufferSend(recBuf, out, m * 2, 0);  // якщо буфер повний — відліки губляться, але не зависаємо
  }
}

void wavHeader(File& f, uint32_t dataBytes) {
  uint8_t h[44];
  auto w32 = [&](int o, uint32_t v) { h[o] = v; h[o + 1] = v >> 8; h[o + 2] = v >> 16; h[o + 3] = v >> 24; };
  auto w16 = [&](int o, uint16_t v) { h[o] = v; h[o + 1] = v >> 8; };
  memcpy(h, "RIFF", 4); w32(4, 36 + dataBytes); memcpy(h + 8, "WAVEfmt ", 8);
  w32(16, 16); w16(20, 1); w16(22, 1); w32(24, REC_RATE_OUT); w32(28, REC_RATE_OUT * 2); w16(32, 2); w16(34, 16);
  memcpy(h + 36, "data", 4); w32(40, dataBytes);
  f.seek(0); f.write(h, 44);
}

void recStartNote() {
  if (recording) { toast("Вже записую", "Стоп: кнопка 2"); return; }
  if (!sdOk) { toast("Немає SD-картки", "запис неможливий"); return; }
  if (!micOk) { toast("Мікрофон", "не відповідає"); return; }
  uint32_t n = prefs.getUInt("recN", 0) + 1; prefs.putUInt("recN", n);
  snprintf(recPath, sizeof(recPath), "/rec/%05lu.wav", (unsigned long)n);
  // Якщо саме надсилається попередня нотатка (SD зайнята), не чекаємо, щоб не завис пристрій
  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(50)) != pdTRUE) { toast("Зачекай кілька с", "надсилаю нотатку..."); return; }
  recFile = SD.open(recPath, FILE_WRITE);
  bool fileOk = recFile;
  if (fileOk) { uint8_t zero[44] = {0}; recFile.write(zero, 44); }
  xSemaphoreGive(sdMutex);
  if (!fileOk) { toast("Помилка SD", "не створився файл"); return; }
  if (!micStart()) {
    xSemaphoreTake(sdMutex, portMAX_DELAY); recFile.close(); SD.remove(recPath); xSemaphoreGive(sdMutex);
    toast("Мікрофон", "помилка I2S"); return;
  }
  xStreamBufferReset(recBuf);
  recLat = gpsFix() ? gps.location.lat() : NAN;
  recLon = gpsFix() ? gps.location.lng() : NAN;
  recording = true; recStart = millis(); recSamples = 0; recDc = 0;
  recActive = true;
  char ev[160];
  snprintf(ev, sizeof(ev), "{\"type\":\"rec\",\"on\":true,\"lat\":%s,\"lon\":%s}", fmtCoord(recLat).c_str(), fmtCoord(recLon).c_str());
  mqttEvent(ev);
  Serial.printf("Запис %s\n", recPath);
}

// Переписати накопичене з recBuf на SD
void recDrain() {
  static uint8_t chunk[2048];
  for (;;) {
    size_t n = xStreamBufferReceive(recBuf, chunk, sizeof(chunk), 0);
    if (!n) break;
    xSemaphoreTake(sdMutex, portMAX_DELAY);
    recFile.write(chunk, n);
    xSemaphoreGive(sdMutex);
    recSamples += n / 2;
  }
}

void recPump() {
  if (!recording) return;
  recDrain();
  if (millis() - recStart >= REC_MAX_MS) { recStopNote(); toast("Ліміт 60 с", "запис зупинено", 3000); }
}

void recStopNote() {
  if (!recording) { toast("Мікрофон вимкнено"); return; }
  recActive = false;
  while (!recTaskIdle) delay(2);                      // дочекатися, поки задача мікрофона відпустить I2S
  micStop();
  recDrain();
  recording = false;
  uint32_t bytes = recSamples * 2;
  xSemaphoreTake(sdMutex, portMAX_DELAY);
  wavHeader(recFile, bytes);
  recFile.close();
  xSemaphoreGive(sdMutex);
  int32_t dur = recSamples * 1000 / REC_RATE_OUT;
  mqttEvent("{\"type\":\"rec\",\"on\":false}");
  if (dur < 500) {
    xSemaphoreTake(sdMutex, portMAX_DELAY); SD.remove(recPath); xSemaphoreGive(sdMutex);
    toast("Запис закороткий", "нотатку не збережено"); return;
  }
  // метадані поруч, щоб після перезапуску дослати
  String meta = String(recPath); meta.replace(".wav", ".txt");
  xSemaphoreTake(sdMutex, portMAX_DELAY);
  File m = SD.open(meta, FILE_WRITE);
  if (m) { m.printf("%s,%s,%ld\n", fmtCoord(recLat).c_str(), fmtCoord(recLon).c_str(), (long)dur); m.close(); }
  xSemaphoreGive(sdMutex);
  Job j{}; j.type = JOB_VOICE; j.lat = recLat; j.lon = recLon; j.durMs = dur; strlcpy(j.path, recPath, sizeof(j.path));
  queueJob(j);
  toast("Нотатку збережено", WiFi.status() == WL_CONNECTED ? "надсилаю на сайт..." : "надішлю, коли буде мережа", 3000);
}

// Нотатки, що не встигли піти до вимкнення
void queuePendingNotes() {
  xSemaphoreTake(sdMutex, portMAX_DELAY);
  File dir = SD.open("/rec");
  if (!dir) { SD.mkdir("/rec"); xSemaphoreGive(sdMutex); return; }
  int n = 0;
  for (File f = dir.openNextFile(); f; f = dir.openNextFile()) {
    String name = String(f.path());
    f.close();
    if (!name.endsWith(".txt")) continue;
    File m = SD.open(name);
    String line = m ? m.readStringUntil('\n') : ""; if (m) m.close();
    int c1 = line.indexOf(','), c2 = line.indexOf(',', c1 + 1);
    String wav = name; wav.replace(".txt", ".wav");
    if (c1 < 0 || c2 < 0 || !SD.exists(wav)) { SD.remove(name); continue; }
    Job j{}; j.type = JOB_VOICE;
    String la = line.substring(0, c1), lo = line.substring(c1 + 1, c2);
    j.lat = la == "null" ? NAN : la.toDouble(); j.lon = lo == "null" ? NAN : lo.toDouble();
    j.durMs = line.substring(c2 + 1).toInt();
    strlcpy(j.path, wav.c_str(), sizeof(j.path));
    queueJob(j); n++;
  }
  dir.close();
  xSemaphoreGive(sdMutex);
  if (n) Serial.printf("Недоставлених нотаток: %d, надсилаю\n", n);
}

// =====================================================================
//                                 SOS
// =====================================================================
bool gsmCmd(const char* cmd, const char* expect, uint32_t ms) {
  if (cmd[0]) { while (Serial2.available()) Serial2.read(); Serial2.println(cmd); }
  String r; uint32_t t0 = millis();
  while (millis() - t0 < ms) {
    while (Serial2.available()) r += (char)Serial2.read();
    if (r.indexOf(expect) >= 0) return true;
    delay(10);
  }
  return false;
}

void gsmProbe() {
  Serial2.begin(9600, SERIAL_8N1, PIN_GSM_RX, PIN_GSM_TX);
  for (int i = 0; i < 3 && !gsmOk; i++) gsmOk = gsmCmd("AT", "OK", 500);
  Serial.println(gsmOk ? "SIM800L: є" : "SIM800L: не підключений (SOS піде лише на сайт)");
  if (gsmOk) { gsmCmd("ATE0", "OK", 500); gsmCmd("AT+CMGF=1", "OK", 1000); }
}

void triggerSos() {
  char phone[24], name[32];
  xSemaphoreTake(sosMutex, portMAX_DELAY);
  strlcpy(phone, sosPhone, sizeof(phone)); strlcpy(name, sosName, sizeof(name));
  xSemaphoreGive(sosMutex);
  double lat = gpsFix() ? gps.location.lat() : NAN, lon = gpsFix() ? gps.location.lng() : NAN;
  bool called = false;

  sosShownUntil = millis() + 15000;
  if (gsmOk && phone[0]) {
    String sms = String("SOS Rivnohid! ") + (isnan(lat) ? String("Koordynat nemaye") :
                 String("https://maps.google.com/?q=") + String(lat, 6) + "," + String(lon, 6));
    if (gsmCmd((String("AT+CMGS=\"") + phone + "\"").c_str(), ">", 3000)) {
      Serial2.print(sms); Serial2.write(26);
      gsmCmd("", "OK", 8000);
    }
    called = gsmCmd((String("ATD") + phone + ";").c_str(), "OK", 5000);
    sosCalling = called;
  }
  char ev[200];
  snprintf(ev, sizeof(ev), "{\"type\":\"sos\",\"lat\":%s,\"lon\":%s,\"called\":%s}",
           fmtCoord(lat).c_str(), fmtCoord(lon).c_str(), called ? "true" : "false");
  mqttEvent(ev);
  Job j{}; j.type = JOB_SOS; j.lat = lat; j.lon = lon; j.called = called;
  queueJob(j);
  Serial.printf("SOS! телефон=%s дзвінок=%d\n", phone[0] ? phone : "(не задано)", called);
}

void sosHangup() {
  if (gsmOk) gsmCmd("ATH", "OK", 2000);
  sosCalling = false; sosShownUntil = 0;
  toast("SOS скасовано");
  mqttEvent("{\"type\":\"sos_cancel\"}");
}

// =====================================================================
//                          Кнопка 3: стан доріг
// =====================================================================
void roadToggle() {
  roadMode = !roadMode;
  roadWinStart = millis(); roadSumSq = 0; roadN = 0; roadPeak = 0; roadHasLast = false;
  toast(roadMode ? "Карта доріг: ВКЛ" : "Карта доріг: ВИКЛ",
        roadMode ? (gpsFix() ? "позначка раз на 10 с" : "чекаю GPS...") : String("позначок: ") + roadMarks);
  mqttEvent(roadMode ? "{\"type\":\"road\",\"on\":true}" : "{\"type\":\"road\",\"on\":false}");
}

void roadTick() {
  if (!roadMode || millis() - roadWinStart < ROAD_WINDOW_MS) return;
  float rms = roadN ? sqrtf(roadSumSq / roadN) : 0;
  float pk = roadPeak;
  roadWinStart = millis(); roadSumSq = 0; roadN = 0; roadPeak = 0;
  if (!gpsFix()) return;
  double lat = gps.location.lat(), lon = gps.location.lng();
  if (roadHasLast && TinyGPSPlus::distanceBetween(lat, lon, roadLastLat, roadLastLon) < ROAD_MIN_MOVE_M) return;
  roadLastLat = lat; roadLastLon = lon; roadHasLast = true;
  // Ті самі межі, що на сторінці /live
  const char* sev = (rms >= 0.14f || pk >= BUMP_G) ? "bad" : rms >= 0.06f ? "warning" : "ok";
  Job j{}; j.type = JOB_MARKER; j.lat = lat; j.lon = lon; strlcpy(j.sev, sev, sizeof(j.sev));
  snprintf(j.desc, sizeof(j.desc), "Авто: RMS %.2f g, пік %.2f g", rms, pk);
  queueJob(j);
  roadMarks++;
}

// =====================================================================
//                            Обробка відліку
// =====================================================================
void sendBatch() {
  float rms = sqrtf(sumSq / BATCH);
  lastRms = rms;
  bool bump = (peak >= BUMP_G) && (millis() - lastBumpMs > 700);
  if (bump) { lastBumpMs = millis(); bumpLedUntil = millis() + 200; }

  static char buf[900];
  int p = snprintf(buf, sizeof(buf), "{\"seq\":%lu,\"t\":%lu,\"hz\":%d,\"a\":[", (unsigned long)seq++, (unsigned long)millis(), SAMPLE_HZ);
  for (int i = 0; i < BATCH; i++) p += snprintf(buf + p, sizeof(buf) - p, i ? ",%d" : "%d", batchBuf[i]);
  p += snprintf(buf + p, sizeof(buf) - p, "],\"rms\":%.3f,\"pk\":%.3f,\"bump\":%d,\"mark\":0,\"bat\":%.2f,\"rec\":%d,\"road\":%d",
                rms, peak, bump ? 1 : 0, batteryV(), recording ? 1 : 0, roadMode ? 1 : 0);
  if (gpsFix())
    p += snprintf(buf + p, sizeof(buf) - p, ",\"lat\":%.6f,\"lon\":%.6f,\"spd\":%.1f,\"sat\":%d",
                  gps.location.lat(), gps.location.lng(), gps.speed.kmph(), (int)gps.satellites.value());
  else
    p += snprintf(buf + p, sizeof(buf) - p, ",\"sat\":%d", (int)gps.satellites.value());
  snprintf(buf + p, sizeof(buf) - p, "}");
  if (mqtt.connected()) mqtt.publish(MQTT_TOPIC, buf);

  static uint8_t k = 0;
  if (++k % 50 == 0) {
    Serial.printf("rms=%.3f mqtt=%d wifi=%d sat=%d bad=%lu rec=%d road=%d heap=%u\n", rms, mqtt.connected(),
                  WiFi.status() == WL_CONNECTED, (int)gps.satellites.value(), (unsigned long)badReads, recording, roadMode, ESP.getFreeHeap());
    badReads = 0;
  }
  batchN = 0; sumSq = 0; peak = 0;
}

void onSample(float av) {
  batchBuf[batchN++] = (int16_t)lroundf(av * 1000.0f);
  sumSq += av * av;
  if (fabsf(av) > peak) peak = fabsf(av);
  if (roadMode) { roadSumSq += av * av; roadN++; if (fabsf(av) > roadPeak) roadPeak = fabsf(av); }
  if (batchN >= BATCH) sendBatch();
}

// =====================================================================
//                                Екран
// =====================================================================
void drawScreen() {
  if (!oledOk) return;
  static uint32_t last = 0;
  if (millis() - last < 250) return;
  last = millis();

  String l1, l2;
  if (millis() < sosShownUntil) {
    l1 = "!!! SOS !!!";
    xSemaphoreTake(sosMutex, portMAX_DELAY);
    String ph = sosPhone; xSemaphoreGive(sosMutex);
    if (sosCalling) l2 = "Дзвоню " + ph;
    else if (!ph.length()) l2 = "Номер не задано!";
    else l2 = gsmOk ? "Не вдалося подзвонити" : "Надіслано на сайт";
  } else if (recording) {
    uint32_t s = (millis() - recStart) / 1000;
    char t[24]; snprintf(t, sizeof(t), "%lu:%02lu", (unsigned long)(s / 60), (unsigned long)(s % 60));
    l1 = String((millis() / 500) % 2 ? "* " : "  ") + "Запис голосу " + t;
    l2 = "Стоп: кнопка 2";
  } else if (millis() < toastUntil) {
    l1 = toast1; l2 = toast2;
  } else {
    int idx = min(100, (int)lroundf(lastRms / 0.35f * 100));
    const char* lvl = lastRms < 0.06f ? "Рівно" : lastRms < 0.14f ? "Нерівно" : lastRms < 0.25f ? "Погано" : "Дуже погано";
    l1 = String(WiFi.status() == WL_CONNECTED ? (mqtt.connected() ? "Онлайн" : "Wi-Fi") : "Без мережі") +
         "  GPS:" + (gpsFix() ? String((int)gps.satellites.value()) : String("-"));
    float v = batteryV();
    if (v > 2.5f) l1 += "  " + String(constrain((int)((v - 3.3f) / 0.9f * 100), 0, 100)) + "%";
    l2 = sensorOk ? String(lvl) + " " + idx : String("Датчик не відповідає");
    if (roadMode) l2 += "  Карта";
  }

  static String p1, p2;
  if (l1 == p1 && l2 == p2 && !recording) return;
  p1 = l1; p2 = l2;
  oled.clearBuffer();
  oled.setCursor(0, 13); oled.print(l1);
  oled.setCursor(0, 30); oled.print(l2);
  oled.sendBuffer();
}

// =====================================================================
//                               Кнопки
// =====================================================================
struct Button { uint8_t pin; bool down; uint32_t since; bool longFired; };
Button btns[4] = {{PIN_BTN1}, {PIN_BTN2}, {PIN_BTN3}, {PIN_BTN4}};

void handleButtons() {
  for (int i = 0; i < 4; i++) {
    Button& b = btns[i];
    bool pressed = digitalRead(b.pin) == LOW;
    if (pressed && !b.down && millis() - b.since > 40) {          // натиснули
      b.down = true; b.since = millis(); b.longFired = false;
      if (i == 0) recStartNote();
      if (i == 1) recStopNote();
      if (i == 2) roadToggle();
      if (i == 3) {
        if (sosCalling || millis() < sosShownUntil) { sosHangup(); b.longFired = true; }
        else toast("SOS: тримай 2 с", "відпусти, щоб скасувати", 2200);
      }
    } else if (pressed && b.down && i == 3 && !b.longFired && millis() - b.since >= SOS_HOLD_MS && millis() >= sosShownUntil) {
      b.longFired = true; triggerSos();
    } else if (!pressed && b.down && millis() - b.since > 40) {
      b.down = false; b.since = millis();
    }
  }
}

// =====================================================================
//                       Результати з мережевої задачі
// =====================================================================
void handleResults() {
  Result r;
  while (xQueueReceive(resQ, &r, 0) == pdTRUE) {
    char ev[200];
    switch (r.type) {
      case RES_VOICE_OK:
        voiceInFlight--;
        toast("Нотатку надіслано", isnan(r.lat) ? "без координат" : "є на карті");
        snprintf(ev, sizeof(ev), "{\"type\":\"voice\",\"id\":\"%s\",\"lat\":%s,\"lon\":%s,\"dur\":%ld}",
                 r.id, fmtCoord(r.lat).c_str(), fmtCoord(r.lon).c_str(), (long)r.durMs);
        mqttEvent(ev);
        break;
      case RES_VOICE_FAIL: voiceInFlight--; toast("Нотатка не пішла", "спробую пізніше"); break;
      case RES_MARKER_OK:
        snprintf(ev, sizeof(ev), "{\"type\":\"marker\",\"lat\":%s,\"lon\":%s}", fmtCoord(r.lat).c_str(), fmtCoord(r.lon).c_str());
        mqttEvent(ev);
        break;
      case RES_SOS_FAIL: toast("SOS не дійшов", "на сайт!"); break;
      case RES_HELLO_OK:
        xSemaphoreTake(sosMutex, portMAX_DELAY);
        if (strcmp(prefs.getString("sos", "").c_str(), sosPhone) != 0) prefs.putString("sos", sosPhone);
        Serial.printf("Номер SOS з сайту: %s\n", sosPhone[0] ? sosPhone : "(не задано)");
        diagDirty = true;
        xSemaphoreGive(sosMutex);
        break;
      case RES_HELLO_FAIL: Serial.println("device_hello не вдався (токен або міграція?)"); break;
      default: break;
    }
  }
}

void retryFailedNotes() {
  static uint32_t last = 0;
  if (millis() - last < 120000 || WiFi.status() != WL_CONNECTED || voiceInFlight > 0) return;
  last = millis();
  if (sdOk && !recording) queuePendingNotes();
}

void checkBattery() {
  static uint32_t lowSince = 0, lastCheck = 0;
  if (millis() - lastCheck < 1000) return;
  lastCheck = millis();
  float v = batteryV();
  if (v < 2.5f || v >= BATT_CUTOFF) { lowSince = 0; return; }
  if (!lowSince) lowSince = millis();
  if (millis() - lowSince > 10000) {
    if (recording) recStopNote();
    if (mqtt.connected()) { mqtt.publish(MQTT_STATUS, "low_battery", true); mqtt.loop(); delay(200); }
    if (oledOk) { oled.clearBuffer(); oled.setCursor(0, 13); oled.print("Розряджено"); oled.setCursor(0, 30); oled.print("Заряди мене"); oled.sendBuffer(); }
    esp_deep_sleep_start();
  }
}

// =====================================================================
//                              setup / loop
// =====================================================================
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== РІВНОХІД v2 ===");
  pinMode(PIN_LED_R, OUTPUT); pinMode(PIN_LED_G, OUTPUT); pinMode(PIN_LED_B, OUTPUT);
  for (auto& b : btns) pinMode(b.pin, INPUT_PULLUP);
  led(1, 1, 0);
  prefs.begin("rivnohid", false);
  sosMutex = xSemaphoreCreateMutex();
  sdMutex = xSemaphoreCreateMutex();
  recBuf = xStreamBufferCreate(32 * 1024, 1);          // ~2 с голосу про запас
  strlcpy(sosPhone, prefs.getString("sos", "").c_str(), sizeof(sosPhone));
  jobQ = xQueueCreate(12, sizeof(Job));
  resQ = xQueueCreate(12, sizeof(Result));

  Wire.begin(PIN_SDA, PIN_SCL, 100000);
  Wire.setTimeOut(50);
  i2cScan();
  Wire.beginTransmission(0x3C);
  if (Wire.endTransmission() == 0) {
    oled.setI2CAddress(0x3C * 2);
    oled.setBusClock(100000);
    oled.begin();
    oled.enableUTF8Print();
    oled.setFont(u8g2_font_6x13_t_cyrillic);
    oledOk = true;
    oled.clearBuffer(); oled.setCursor(0, 13); oled.print("Рівнохід"); oled.setCursor(0, 30); oled.print("Запуск..."); oled.sendBuffer();
  } else Serial.println("OLED 0x3C не знайдено");

  sdOk = SD.begin(PIN_SD_CS);
  Serial.println(sdOk ? "SD: OK" : "SD: немає картки");
  if (sdOk && !SD.exists("/rec")) SD.mkdir("/rec");

  micProbe();
  xTaskCreatePinnedToCore(micTask, "mic", 4096, nullptr, 3, nullptr, 1);
  gsmProbe();
  Serial1.begin(9600, SERIAL_8N1, PIN_GPS_RX, -1);

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(15);
  if (oledOk) { oled.clearBuffer(); oled.setCursor(0, 13); oled.print("Шукаю Wi-Fi..."); oled.sendBuffer(); }
  ensureWifi();
  ensureMqtt();

  xTaskCreatePinnedToCore(netTask, "net", 16384, nullptr, 1, nullptr, 0);
  Job hello{}; hello.type = JOB_HELLO; queueJob(hello);
  if (sdOk) queuePendingNotes();

  sensorOk = mpuInit();
  if (oledOk) { oled.clearBuffer(); oled.setCursor(0, 13); oled.print("Калібрування"); oled.setCursor(0, 30); oled.print("не рухай 2 с"); oled.sendBuffer(); }
  if (sensorOk) calibrate();
  toast("Готово", String(sdOk ? "SD " : "") + (micOk ? "Мікр " : "") + (gsmOk ? "GSM" : ""));
}

void loop() {
  if (otaStarted) ArduinoOTA.handle();
  if (otaActive) return;

  checkBattery();
  while (Serial1.available()) gps.encode(Serial1.read());
  handleButtons();
  recPump();

  // Акселерометр
  if (!sensorOk) {
    static uint32_t lastTry = 0;
    if (millis() - lastTry > 3000) { lastTry = millis(); if (mpuInit()) { sensorOk = true; calibrate(); } }
  } else {
    static uint32_t lastDrain = 0;
    if (millis() - lastDrain >= 20) { lastDrain = millis(); mpuDrainFifo(); }
    if (millis() - lastGoodRead > 3000) {                 // датчик замовк — переналаштувати
      Wire.end(); delay(5); Wire.begin(PIN_SDA, PIN_SCL, 100000); Wire.setTimeOut(50);
      if (mpuInit()) lastGoodRead = millis() - 1000; else sensorOk = false;
    }
  }
  roadTick();
  recPump();

  // Мережа
  static uint32_t lastNet = 0, lastWifiTry = 0, lastHello = 0;
  if (millis() - lastNet > 1000) {
    lastNet = millis();
    // Під час запису не скануємо ефір: сканування блокує на кілька секунд
    if (WiFi.status() != WL_CONNECTED && !recording && millis() - lastWifiTry > WIFI_SCAN_EVERY) {
      lastWifiTry = millis(); connectBestKnown();
    }
    if (WiFi.status() == WL_CONNECTED) startOta();
    ensureMqtt();
    publishState();
    publishDiag();
    if (millis() - lastHello > HELLO_EVERY_MS) { lastHello = millis(); Job h{}; h.type = JOB_HELLO; queueJob(h); }
  }
  mqtt.loop();
  handleResults();
  retryFailedNotes();
  drawScreen();

  // Світлодіод
  if (millis() < sosShownUntil)        led((millis() / 200) % 2, 0, 0);
  else if (recording)                  led((millis() / 400) % 2, 0, (millis() / 400) % 2);
  else if (!sensorOk)                  led((millis() / 300) % 2, 0, 0);
  else if (millis() < bumpLedUntil)    led(0, 0, 1);
  else if (mqtt.connected())           led(0, 1, 0);
  else                                 led(1, 1, 0);
}
