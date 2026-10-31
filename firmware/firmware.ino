/*
  РІВНОХІД v3: акселерометр і GPS наживо, точки з нотатками й голосом, трек доріг, SOS
  ---------------------------------------------------------------------------
  Плата:  ESP32 Dev Module (ESP32 DevKit V1)

  Підключення (див. docs у проєкті):
    I2C  SDA=21 SCL=22   MPU6050 (0x68), екран: OLED SSD1306 128x32 (0x3C/0x3D) або LCD 1602 з I2C-адаптером (0x27/0x3F)
    SD   CS=5 SCK=18 MOSI=23 MISO=19
    Мікрофон INMP441  SCK=26 WS=25 SD=39 (L/R на GND)
    GPS  TX модуля -> 35
    SIM800L (необов'язково) TXD->16, RXD<-17
    Кнопки (другий вивід на GND): 1=32 запис голосу, 2=33 стоп мікрофона,
                                  3=14 поставити точку на карті, 4=15 SOS (утримати 2 с)
    RGB світлодіод R=13 G=4 B=2, дільник акумулятора -> 34

  Бібліотеки (Library Manager): PubSubClient, TinyGPSPlus, U8g2
  Налаштування: firmware/secrets.h (див. secrets.example.h)

  Куди йдуть дані:
    * акселерометр 200 Гц  -> MQTT rivnohid/rv7f3k/live   -> сторінка /live
    * стан пристрою         -> MQTT rivnohid/rv7f3k/status (retained)
    * події (запис, SOS...) -> MQTT rivnohid/rv7f3k/event
    * точки, голос, SOS     -> Supabase (RPC device_*)     -> карта і навігатор сайту
    * GPS-трек зі струсом   -> Supabase device_add_track    -> «обстежені дороги» в навігаторі

  Точки (кнопка 3): ставиться точка там, де натиснули, з кольором стану дороги за останні 10 с.
  Якщо протягом 2 хв після цього записати голос (кнопка 1 → 2), запис прив'язується до цієї точки.
  Запис без точки сам створює точку там, де його почали. Текст до точки пишуть на сайті.
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
#define FW_VERSION "3.3"

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
#define POINT_LINK_MS    120000      // голос, записаний протягом 2 хв після кнопки 3, іде в цю точку
#define FIX_KEEP_MS      120000      // останній GPS-фікс вважаємо дійсним ще 2 хв (для точки без фіксу)
#define TRACK_EVERY_MS   3000        // точка треку раз на 3 с...
#define TRACK_MIN_MOVE_M 3.0         // ...якщо пристрій зрушив хоча б на 3 м
#define TRACK_SEND_MS    20000       // надсилати трек раз на 20 с
#define TRACK_CAP        600         // у RAM до 600 точок (30 хв без мережі)
#define TRACK_BATCH      100         // точок в одному запиті
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
// SIM800L: чи є SIM, чи зареєстрований у мережі, рівень сигналу 0..31 (99 = невідомо)
bool     gsmSim = false, gsmReg = false;
int      gsmCsq = 99;
bool     otaStarted = false, otaActive = false;
float    gx0, gy0, gz0, gMag;
int16_t  batchBuf[BATCH];
int      batchN = 0;
float    sumSq = 0, peak = 0;
uint32_t seq = 0, bumpLedUntil = 0, lastBumpMs = 0, lastGoodRead = 0, badReads = 0;
float    lastRms = 0;
String   publishedState = "";
bool     diagDirty = true;      // треба (пере)опублікувати діагностику
bool     batLow = false;        // акумулятор сідає (лише попередження)

// Стан дороги за останні 10 с: RMS² і пік кожного пакета (100 мс)
#define RING_N 100
float    ringSq[RING_N], ringPk[RING_N];
uint8_t  ringHead = 0, ringFill = 0;

// Останній надійний GPS-фікс
double   fixLat = NAN, fixLon = NAN;
uint32_t fixMs = 0;

// Кнопка 3: точки
uint16_t pointSeq = 0;               // номер останньої точки (з 1 після ввімкнення)
uint32_t pointAt = 0;                // коли її поставили
uint16_t pointsSent = 0;
uint16_t recPointSeq = 0;            // до якої точки йде поточний запис (0 — створити нову)

// Трек: кільцевий буфер точок, поки не підтвердить сервер
struct TrackPt { float lat, lon; int16_t rmsMg; uint32_t ms; };
TrackPt  track[TRACK_CAP];
uint16_t trackHead = 0, trackCount = 0, trackInFlight = 0;
double   trackLastLat = NAN, trackLastLon = NAN;
uint32_t trackSaved = 0;

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
StreamBufferHandle_t recBuf = nullptr;   // створюється лише на час запису (звільняє RAM для HTTPS)
volatile bool recActive = false, recTaskIdle = true, recDcInit = false;
SemaphoreHandle_t sdMutex;
// Без SD-картки запис іде в RAM: 8 кГц, 8 біт, до ~8 с
#define RAM_REC_MAX  (64 * 1024)
bool     recToRam = false, ramFull = false;
uint8_t* ramRec = nullptr;
uint32_t ramCap = 0, ramLen = 0;

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
enum JobType : uint8_t { JOB_HELLO, JOB_POINT, JOB_VOICE, JOB_SOS, JOB_TRACK };
struct Job {
  JobType type;
  double  lat, lon;
  int32_t durMs;
  char    sev[8];
  char    path[32];
  uint8_t* mem;        // нотатка в RAM (коли немає SD) або JSON треку; звільняє netTask
  uint32_t memLen;
  float   rms;
  bool    called;
  uint16_t pointSeq;   // JOB_POINT: номер точки; JOB_VOICE: до якої точки прив'язати (0 — нова)
  uint16_t n;          // JOB_TRACK: скільки точок у пачці
};
enum ResType : uint8_t { RES_VOICE_OK, RES_VOICE_FAIL, RES_POINT_OK, RES_POINT_FAIL, RES_SOS_OK, RES_SOS_FAIL,
                         RES_HELLO_OK, RES_HELLO_FAIL, RES_TRACK_OK, RES_TRACK_FAIL };
struct Result { ResType type; char id[40]; double lat, lon; int32_t durMs; uint16_t n; char sev[8]; };
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

// GPS-фікс, якому можна вірити. В Україні сигнал часто підміняють (РЕБ):
// приймаємо лише координати в межах України, з ≥4 супутниками й нормальною точністю.
bool gpsFix() {
  if (!gps.location.isValid() || gps.location.age() >= 3000) return false;
  if (gps.satellites.isValid() && gps.satellites.value() < 4) return false;
  if (gps.hdop.isValid() && gps.hdop.hdop() > 5.0) return false;
  double la = gps.location.lat(), lo = gps.location.lng();
  return la > 44.0 && la < 52.5 && lo > 22.0 && lo < 40.5;
}

float batteryV() { return analogRead(PIN_BATT) / 4095.0f * 3.3f * 2.0f; }

void mqttEvent(const char* json) {
  if (mqtt.connected()) mqtt.publish(MQTT_EVENT, json);
}

String fmtCoord(double v) { return isnan(v) ? String("null") : String(v, 6); }

// Координата для точки чи запису: поточний фікс або останній за 2 хв
bool bestFix(double& lat, double& lon) {
  if (gpsFix()) { lat = gps.location.lat(); lon = gps.location.lng(); return true; }
  if (fixMs && millis() - fixMs < FIX_KEEP_MS) { lat = fixLat; lon = fixLon; return true; }
  lat = lon = NAN; return false;
}

// RMS і пік за останні n пакетів (n×100 мс)
float ringRms(int n) {
  n = min(n, (int)ringFill); if (n <= 0) return 0;
  double s = 0;
  for (int i = 0; i < n; i++) s += ringSq[(ringHead + RING_N - 1 - i) % RING_N];
  return sqrtf(s / n);
}
float ringPeak(int n) {
  n = min(n, (int)ringFill); float p = 0;
  for (int i = 0; i < n; i++) p = max(p, ringPk[(ringHead + RING_N - 1 - i) % RING_N]);
  return p;
}
// Стан дороги за 10 с — ті самі межі, що на сторінці /live
const char* roadSeverity() {
  if (!sensorOk || !ringFill) return "ok";
  float rms = ringRms(RING_N), pk = ringPeak(RING_N);
  return (rms >= 0.14f || pk >= BUMP_G) ? "bad" : rms >= 0.06f ? "warning" : "ok";
}
bool pointActive() { return pointSeq && millis() - pointAt < POINT_LINK_MS; }

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

String i2cFound;                 // що відповіло на шині I2C, напр. "3C,68" (йде в діагностику)
void i2cScan() {
  String f;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { char b[4]; snprintf(b, sizeof(b), "%02X", a); if (f.length()) f += ","; f += b; }
  }
  if (f != i2cFound) { i2cFound = f; diagDirty = true; }
  Serial.printf("I2C: %s\n", f.length() ? f.c_str() : "нічого");
}

// ---------- Екран: OLED SSD1306 (0x3C/0x3D) або LCD 1602 з адаптером PCF8574 ----------
// LCD знає лише латиницю, тому український текст для нього транслітерується.
uint8_t screenAddr = 0;
bool    lcdOk = false;
bool    oledFresh = false;       // щойно ініціалізований — перемалювати

static const char* const CYR[32] = {"a","b","v","h","d","e","zh","z","y","i","k","l","m","n","o","p",
                                    "r","s","t","u","f","kh","ts","ch","sh","shch","","y","","e","iu","ia"};
String translit(const String& s) {
  String o; o.reserve(s.length());
  for (size_t i = 0; i < s.length();) {
    uint8_t c = s[i];
    if (c < 0x80) { o += (char)c; i++; continue; }
    uint32_t cp; int n;
    if ((c & 0xE0) == 0xC0 && i + 1 < s.length()) { cp = ((c & 0x1F) << 6) | (s[i + 1] & 0x3F); n = 2; }
    else if ((c & 0xF0) == 0xE0 && i + 2 < s.length()) { cp = ((c & 0x0F) << 12) | ((s[i + 1] & 0x3F) << 6) | (s[i + 2] & 0x3F); n = 3; }
    else { i++; continue; }
    i += n;
    bool up = false;
    const char* r = "?";
    if (cp >= 0x410 && cp <= 0x42F) { up = true; cp += 0x20; }
    if (cp >= 0x430 && cp <= 0x44F) r = CYR[cp - 0x430];
    else if (cp == 0x404 || cp == 0x454) { up = cp == 0x404; r = "ie"; }
    else if (cp == 0x406 || cp == 0x407 || cp == 0x456 || cp == 0x457) { up = cp < 0x450; r = "i"; }
    else if (cp == 0x490 || cp == 0x491) { up = cp == 0x490; r = "g"; }
    else if (cp == 0x2192) r = "->";
    else if (cp == 0x2026) r = "...";
    else if (cp == 0xB7 || cp == 0x2014 || cp == 0x2013) r = "-";
    else if (cp == 0x2019 || cp == 0x2BC) r = "";
    if (up && r[0]) { o += (char)toupper(r[0]); o += (r + 1); } else o += r;
  }
  return o;
}

#define LCD_BL 0x08
#define LCD_EN 0x04
#define LCD_RS 0x01
void lcdExp(uint8_t v) { Wire.beginTransmission(screenAddr); Wire.write(v | LCD_BL); Wire.endTransmission(); }
void lcdNib(uint8_t v) { lcdExp(v | LCD_EN); delayMicroseconds(1); lcdExp(v & ~LCD_EN); delayMicroseconds(50); }
void lcdByte(uint8_t b, uint8_t mode) { lcdNib((b & 0xF0) | mode); lcdNib(((b << 4) & 0xF0) | mode); }
void lcdCmd(uint8_t c) { lcdByte(c, 0); if (c <= 0x03) delay(2); }
void lcdInit() {
  lcdExp(0); delay(50);
  lcdNib(0x30); delayMicroseconds(4500);
  lcdNib(0x30); delayMicroseconds(4500);
  lcdNib(0x30); delayMicroseconds(150);
  lcdNib(0x20);                                   // 4-бітний режим
  lcdCmd(0x28); lcdCmd(0x08); lcdCmd(0x01); lcdCmd(0x06); lcdCmd(0x0C);
}
void lcdLine(uint8_t row, const String& s) {
  lcdCmd(0x80 | (row ? 0x40 : 0));
  String t = translit(s);
  for (int i = 0; i < 16; i++) lcdByte(i < (int)t.length() ? (uint8_t)t[i] : ' ', LCD_RS);
}

bool screenOk() { return oledOk || lcdOk; }
String lcdShown[2];              // що вже на LCD: переписуємо лише змінений рядок (I2C повільний)
void screenShow(const String& l1, const String& l2 = "") {
  if (oledOk) { oled.clearBuffer(); oled.setCursor(0, 13); oled.print(l1); oled.setCursor(0, 30); oled.print(l2); oled.sendBuffer(); }
  else if (lcdOk) {
    if (l1 != lcdShown[0]) { lcdLine(0, l1); lcdShown[0] = l1; }
    if (l2 != lcdShown[1]) { lcdLine(1, l2); lcdShown[1] = l2; }
  }
}

bool i2cHere(uint8_t a) { Wire.beginTransmission(a); return Wire.endTransmission() == 0; }

// Спершу OLED, потім LCD. 0x23 пропускаємо: це датчик світла BH1750.
// Якщо екран не відповів на старті (дріт, повільне живлення), loop() пробує ще раз кожні 3 с.
bool screenTryInit() {
  for (uint8_t a : {0x3C, 0x3D}) {
    if (!i2cHere(a)) continue;
    oled.setI2CAddress(a * 2);
    oled.setBusClock(100000);
    oled.begin();
    oled.enableUTF8Print();
    oled.setFont(u8g2_font_6x13_t_cyrillic);
    screenAddr = a; oledOk = true; oledFresh = true; diagDirty = true;
    Serial.printf("Екран OLED: 0x%02X\n", a);
    return true;
  }
  for (uint8_t a : {0x27, 0x3F, 0x26, 0x25, 0x24, 0x22, 0x21, 0x20, 0x3E, 0x3B, 0x3A, 0x39, 0x38}) {
    if (!i2cHere(a)) continue;
    screenAddr = a;
    lcdInit();
    lcdShown[0] = lcdShown[1] = "";
    lcdOk = true; oledFresh = true; diagDirty = true;
    Serial.printf("Екран LCD 1602: 0x%02X\n", a);
    return true;
  }
  return false;
}

// Екран зник (відійшов дріт) — позначити; з'явився — ініціалізувати заново
void screenWatch() {
  static uint32_t last = 0;
  if (millis() - last < 3000) return;
  last = millis();
  if (screenOk()) {
    if (!i2cHere(screenAddr)) { oledOk = lcdOk = false; diagDirty = true; Serial.println("Екран: зник"); i2cScan(); }
  } else if (screenTryInit()) {
    i2cScan();
  }
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
    screenShow("Оновлення...");
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
  char js[320];
  snprintf(js, sizeof(js),
           "{\"fw\":\"%s\",\"sd\":%d,\"mic\":%d,\"oled\":%d,\"gsm\":%d,\"sim\":%d,\"reg\":%d,\"csq\":%d,\"mpu\":%d,\"sos\":%d,\"ssid\":\"%s\",\"ip\":\"%s\",\"i2c\":\"%s\"}",
           FW_VERSION, sdOk, micOk, screenOk(), gsmOk, gsmSim, gsmReg, gsmCsq, sensorOk, phoneSet,
           WiFi.SSID().c_str(), WiFi.localIP().toString().c_str(), i2cFound.c_str());
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
  B64Body(const String& head, const uint8_t* m, size_t len, const String& tail) : h(head), t(tail), file(nullptr), mem(m) {
    fileSize = len;
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
  const uint8_t* mem = nullptr;
  size_t fileSize = 0, b64Len = 0, pos = 0, outLen = 0, outPos = 0, memPos = 0;
  char out[1024];
  void refill() {
    static const char* A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    uint8_t in[768];
    size_t got;
    if (file) got = file->read(in, sizeof(in));
    else { got = min(sizeof(in), fileSize - memPos); memcpy(in, mem + memPos, got); memPos += got; }
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
  if (code < 0) {
    char err[100] = "";
    cli.lastError(err, sizeof(err));
    Serial.printf("HTTPS помилка %d (%s), TLS: %s, вільно %u, найбільший блок %u\n", code, http.errorToString(code).c_str(),
                  err, ESP.getFreeHeap(), ESP.getMaxAllocHeap());
  }
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

void sendResult(ResType t, const String& id = "", double lat = NAN, double lon = NAN, int32_t dur = 0,
                uint16_t n = 0, const char* sev = "") {
  Result r{}; r.type = t; strlcpy(r.id, id.c_str(), sizeof(r.id)); r.lat = lat; r.lon = lon; r.durMs = dur;
  r.n = n; strlcpy(r.sev, sev, sizeof(r.sev));
  xQueueSend(resQ, &r, 0);
}

// Номер точки на пристрої → її uuid на сервері (лише в netTask)
struct PointId { uint16_t seq; char id[40]; };
PointId pointIds[8];
uint8_t pointIdNext = 0;
String pointUuid(uint16_t seq) {
  if (!seq) return "";
  for (auto& p : pointIds) if (p.seq == seq) return String(p.id);
  return "";
}

// Прив'язка голосу до точки і стан дороги для автоматичної точки
String voiceExtra(const Job& j) {
  String id = pointUuid(j.pointSeq);
  return String(",\"p_point_id\":") + (id.length() ? "\"" + id + "\"" : String("null")) +
         ",\"p_severity\":\"" + (j.sev[0] ? j.sev : "ok") + "\"";
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

    } else if (j.type == JOB_POINT) {
      String js = "{" + tok + ",\"p_lat\":" + fmtCoord(j.lat) + ",\"p_lng\":" + fmtCoord(j.lon) +
                  ",\"p_severity\":\"" + j.sev + "\",\"p_rms\":" + (isnan(j.rms) ? String("null") : String(j.rms, 3)) + "}";
      for (int attempt = 0; attempt < 3 && code != 200; attempt++) {
        code = rpcJson("device_add_point", js, resp);
        if (code != 200) vTaskDelay(pdMS_TO_TICKS(3000));
      }
      String id = jsonStr("{\"x\":" + resp + "}", "x");
      if (code == 200 && id.length()) {
        PointId& p = pointIds[pointIdNext++ % 8]; p.seq = j.pointSeq; strlcpy(p.id, id.c_str(), sizeof(p.id));
      }
      sendResult(code == 200 ? RES_POINT_OK : RES_POINT_FAIL, id, j.lat, j.lon, 0, j.pointSeq, j.sev);

    } else if (j.type == JOB_TRACK) {
      String js = "{" + tok + ",\"p_points\":" + String((const char*)j.mem) + "}";
      free(j.mem);
      code = rpcJson("device_add_track", js, resp);
      sendResult(code == 200 ? RES_TRACK_OK : RES_TRACK_FAIL, "", NAN, NAN, 0, j.n);

    } else if (j.type == JOB_SOS) {
      String js = "{" + tok + ",\"p_lat\":" + fmtCoord(j.lat) + ",\"p_lng\":" + fmtCoord(j.lon) +
                  ",\"p_called\":" + (j.called ? "true" : "false") + "}";
      for (int attempt = 0; attempt < 5 && code != 200; attempt++) {
        code = rpcJson("device_sos", js, resp);
        if (code != 200) vTaskDelay(pdMS_TO_TICKS(3000));
      }
      sendResult(code == 200 ? RES_SOS_OK : RES_SOS_FAIL, "", j.lat, j.lon);

    } else if (j.type == JOB_VOICE && j.mem) {         // нотатка з RAM
      String head = "{" + tok + ",\"p_lat\":" + fmtCoord(j.lat) + ",\"p_lng\":" + fmtCoord(j.lon) +
                    ",\"p_duration_ms\":" + String(j.durMs) + ",\"p_sample_rate\":" + String(REC_RATE_OUT) +
                    voiceExtra(j) + ",\"p_audio_b64\":\"";
      for (int attempt = 0; attempt < 3 && code != 200; attempt++) {
        B64Body body(head, j.mem, j.memLen, "\"}");
        Serial.printf("Надсилаю нотатку з RAM (%u байт)\n", (unsigned)j.memLen);
        code = rpc("device_add_voice_note", &body, body.total, resp);
        if (code != 200) vTaskDelay(pdMS_TO_TICKS(5000));
      }
      free(j.mem);
      if (code == 200) sendResult(RES_VOICE_OK, jsonStr("{\"x\":" + resp + "}", "x"), j.lat, j.lon, j.durMs);
      else { Serial.printf("Голос не надіслано: %d %s\n", code, resp.c_str()); sendResult(RES_VOICE_FAIL); }

    } else if (j.type == JOB_VOICE) {
      while (recording) vTaskDelay(pdMS_TO_TICKS(500));   // не заважаємо новому запису
      xSemaphoreTake(sdMutex, portMAX_DELAY);           // SD не можна читати з двох задач одночасно
      File f = SD.open(j.path, FILE_READ);
      if (!f) { xSemaphoreGive(sdMutex); sendResult(RES_VOICE_FAIL); continue; }
      String head = "{" + tok + ",\"p_lat\":" + fmtCoord(j.lat) + ",\"p_lng\":" + fmtCoord(j.lon) +
                    ",\"p_duration_ms\":" + String(j.durMs) + ",\"p_sample_rate\":" + String(REC_RATE_OUT) +
                    voiceExtra(j) + ",\"p_audio_b64\":\"";
      Serial.printf("Надсилаю %s (%u байт), вільно %u, блок %u\n", j.path, (unsigned)f.size(), ESP.getFreeHeap(), ESP.getMaxAllocHeap());
      for (int attempt = 0; attempt < 3 && code != 200; attempt++) {
        if (attempt) { f.seek(0); xSemaphoreGive(sdMutex); vTaskDelay(pdMS_TO_TICKS(4000)); xSemaphoreTake(sdMutex, portMAX_DELAY); }
        B64Body body(head, &f, "\"}");
        code = rpc("device_add_voice_note", &body, body.total, resp);
      }
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
    if (code != 200 && j.type != JOB_VOICE && j.type != JOB_TRACK) Serial.printf("RPC %d: %d %s\n", j.type, code, resp.c_str());
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
      if (!recDcInit) { recDc = v; recDcInit = true; }  // старт фільтра з першого відліку, без клацання
      recDc += (v - recDc) / 64;                      // прибрати постійну складову
      v -= recDc;
      out[m++] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
    }
    if (m) xStreamBufferSend(recBuf, out, m * 2, 0);  // якщо буфер повний — відліки губляться, але не зависаємо
  }
}

void wavHeaderBytes(uint8_t* h, uint32_t dataBytes, uint16_t bits) {
  auto w32 = [&](int o, uint32_t v) { h[o] = v; h[o + 1] = v >> 8; h[o + 2] = v >> 16; h[o + 3] = v >> 24; };
  auto w16 = [&](int o, uint16_t v) { h[o] = v; h[o + 1] = v >> 8; };
  uint16_t blockAlign = bits / 8;
  memcpy(h, "RIFF", 4); w32(4, 36 + dataBytes); memcpy(h + 8, "WAVEfmt ", 8);
  w32(16, 16); w16(20, 1); w16(22, 1); w32(24, REC_RATE_OUT); w32(28, REC_RATE_OUT * blockAlign); w16(32, blockAlign); w16(34, bits);
  memcpy(h + 36, "data", 4); w32(40, dataBytes);
}

void wavHeader(File& f, uint32_t dataBytes) {
  uint8_t h[44];
  wavHeaderBytes(h, dataBytes, 16);
  f.seek(0); f.write(h, 44);
}

void recStartNote() {
  if (recording) { toast("Вже записую", "Стоп: кнопка 2"); return; }
  if (!micOk) { toast("Мікрофон", "не відповідає"); return; }
  if (!sdOk) {
    // Без SD: короткий запис у RAM
    if (voiceInFlight > 0) { toast("Зачекай кілька с", "надсилаю нотатку..."); return; }
    uint32_t avail = ESP.getMaxAllocHeap();
    ramCap = avail > 60000 + 16000 ? min((uint32_t)RAM_REC_MAX, avail - 60000) : 0;   // 60 КБ лишаємо для HTTPS
    ramRec = ramCap ? (uint8_t*)malloc(ramCap) : nullptr;
    if (!ramRec) { toast("Мало пам'яті", "встав SD-картку"); return; }
    ramLen = 44; ramFull = false; recToRam = true;
    recBuf = xStreamBufferCreate(8 * 1024, 1);
    if (!recBuf) { free(ramRec); ramRec = nullptr; recToRam = false; toast("Мало пам'яті", "встав SD-картку"); return; }
    if (!micStart()) { vStreamBufferDelete(recBuf); recBuf = nullptr; free(ramRec); ramRec = nullptr; recToRam = false; toast("Мікрофон", "помилка I2S"); return; }
    bestFix(recLat, recLon);
    recPointSeq = pointActive() ? pointSeq : 0;
    recording = true; recStart = millis(); recSamples = 0; recDc = 0; recDcInit = false;
    recActive = true;
    char ev[160];
    snprintf(ev, sizeof(ev), "{\"type\":\"rec\",\"on\":true,\"lat\":%s,\"lon\":%s,\"point\":%u}", fmtCoord(recLat).c_str(), fmtCoord(recLon).c_str(), recPointSeq);
    mqttEvent(ev);
    Serial.printf("Запис у RAM, до %lu с\n", (unsigned long)((ramCap - 44) / REC_RATE_OUT));
    return;
  }
  recToRam = false;
  uint32_t n = prefs.getUInt("recN", 0) + 1; prefs.putUInt("recN", n);
  snprintf(recPath, sizeof(recPath), "/rec/%05lu.wav", (unsigned long)n);
  // Якщо саме надсилається попередня нотатка (SD зайнята), не чекаємо, щоб не завис пристрій
  if (xSemaphoreTake(sdMutex, pdMS_TO_TICKS(50)) != pdTRUE) { toast("Зачекай кілька с", "надсилаю нотатку..."); return; }
  recFile = SD.open(recPath, FILE_WRITE);
  bool fileOk = recFile;
  if (fileOk) { uint8_t zero[44] = {0}; recFile.write(zero, 44); }
  xSemaphoreGive(sdMutex);
  if (!fileOk) { toast("Помилка SD", "не створився файл"); return; }
  recBuf = xStreamBufferCreate(16 * 1024, 1);         // ~1 с запасу
  if (!recBuf || !micStart()) {
    if (recBuf) { vStreamBufferDelete(recBuf); recBuf = nullptr; }
    xSemaphoreTake(sdMutex, portMAX_DELAY); recFile.close(); SD.remove(recPath); xSemaphoreGive(sdMutex);
    toast("Мікрофон", "помилка запуску"); return;
  }
  bestFix(recLat, recLon);
  recPointSeq = pointActive() ? pointSeq : 0;
  recording = true; recStart = millis(); recSamples = 0; recDc = 0; recDcInit = false;
  recActive = true;
  char ev[160];
  snprintf(ev, sizeof(ev), "{\"type\":\"rec\",\"on\":true,\"lat\":%s,\"lon\":%s,\"point\":%u}", fmtCoord(recLat).c_str(), fmtCoord(recLon).c_str(), recPointSeq);
  mqttEvent(ev);
  Serial.printf("Запис %s%s\n", recPath, recPointSeq ? (" → точка " + String(recPointSeq)).c_str() : " (нова точка)");
}

// Переписати накопичене з recBuf на SD
void recDrain() {
  static uint8_t chunk[2048];
  if (recToRam) {
    for (;;) {
      size_t n = xStreamBufferReceive(recBuf, chunk, sizeof(chunk), 0);
      if (!n) break;
      int16_t* s16 = (int16_t*)chunk;
      for (size_t i = 0; i < n / 2; i++) {
        if (ramLen >= ramCap) { ramFull = true; break; }
        int v = s16[i] >> 5;                                  // голос тихий: +8x відносно простого >>8
        v = v > 127 ? 127 : v < -128 ? -128 : v;
        ramRec[ramLen++] = (uint8_t)(v + 128);                // 8 біт без знака
      }
    }
    recSamples = ramLen - 44;
    return;
  }
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
  if (recToRam && ramFull) { recStopNote(); toast("Ліміт без SD-картки", "нотатку надсилаю", 3000); return; }
  if (millis() - recStart >= REC_MAX_MS) { recStopNote(); toast("Ліміт 60 с", "запис зупинено", 3000); }
}

void recStopNote() {
  if (!recording) { toast("Мікрофон вимкнено"); return; }
  recActive = false;
  while (!recTaskIdle) delay(2);                      // дочекатися, поки задача мікрофона відпустить I2S
  micStop();
  recDrain();
  recording = false;
  vStreamBufferDelete(recBuf); recBuf = nullptr;
  if (recToRam) {
    recToRam = false;
    uint32_t bytes = ramLen - 44;
    int32_t dur = bytes * 1000 / REC_RATE_OUT;
    mqttEvent("{\"type\":\"rec\",\"on\":false}");
    if (dur < 500) { free(ramRec); ramRec = nullptr; toast("Запис закороткий", "нотатку не збережено"); return; }
    wavHeaderBytes(ramRec, bytes, 8);
    Job j{}; j.type = JOB_VOICE; j.lat = recLat; j.lon = recLon; j.durMs = dur; j.mem = ramRec; j.memLen = ramLen;
    j.pointSeq = recPointSeq; strlcpy(j.sev, roadSeverity(), sizeof(j.sev));
    ramRec = nullptr;                                 // тепер буфером володіє netTask
    if (xQueueSend(jobQ, &j, 0) != pdTRUE) { free(j.mem); toast("Черга повна", "нотатку втрачено"); return; }
    voiceInFlight++;
    toast(recPointSeq ? "Голос → точка " + String(recPointSeq) : String("Нотатку записано"),
          WiFi.status() == WL_CONNECTED ? "надсилаю на сайт..." : "надішлю, коли буде мережа", 3000);
    return;
  }
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
  j.pointSeq = recPointSeq; strlcpy(j.sev, roadSeverity(), sizeof(j.sev));
  queueJob(j);
  toast(recPointSeq ? "Голос → точка " + String(recPointSeq) : String("Нотатку збережено"),
        WiFi.status() == WL_CONNECTED ? "надсилаю на сайт..." : "надішлю, коли буде мережа", 3000);
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
// Надіслати AT-команду й дочекатися потрібної відповіді; повну відповідь кладе в out
bool gsmCmd(const char* cmd, const char* expect, uint32_t ms, String* out = nullptr) {
  if (cmd[0]) { while (Serial2.available()) Serial2.read(); Serial2.println(cmd); }
  String r; uint32_t t0 = millis();
  bool ok = false;
  while (millis() - t0 < ms) {
    while (Serial2.available()) r += (char)Serial2.read();
    if (r.indexOf(expect) >= 0) { ok = true; break; }
    if (r.indexOf("ERROR") >= 0) break;
    delay(5);
  }
  if (out) *out = r;
  return ok;
}

// Кожен виклик пробує наступний варіант: звичайні або переплутані TX/RX і 5 швидкостей.
// Знайдений варіант запам'ятовується в NVS. Якщо модем щось шле, але не "OK", —
// друкуємо сирі байти: значить дроти є, а швидкість чи рівні не ті.
void gsmProbe() {
  static const uint32_t B[] = {9600, 115200, 57600, 38400, 19200};
  const int N = 10;
  static int v = -1;
  if (v < 0) v = constrain((int)prefs.getUChar("gsmV", 0), 0, N - 1);
  else v = (v + 1) % N;
  int8_t rx = v % 2 ? PIN_GSM_TX : PIN_GSM_RX, tx = v % 2 ? PIN_GSM_RX : PIN_GSM_TX;
  uint32_t baud = B[v / 2];
  Serial2.end();
  Serial2.begin(baud, SERIAL_8N1, rx, tx);
  delay(20);
  String raw;
  for (int i = 0; i < 2 && !gsmOk; i++) { gsmOk = gsmCmd("AT", "OK", 150, &raw); }   // 2 AT для автопідбору швидкості; ≤300 мс, щоб FIFO акселерометра (0.85 с) не переповнився
  if (!gsmOk) {
    Serial.printf("SIM800L: немає відповіді (RX=%d TX=%d %lu бод)", rx, tx, (unsigned long)baud);
    if (raw.length()) {
      Serial.printf(" — але прийшло %d байт:", raw.length());
      for (int i = 0; i < (int)raw.length() && i < 12; i++) Serial.printf(" %02X", (uint8_t)raw[i]);
    }
    Serial.println();
    return;
  }
  Serial.printf("SIM800L: знайдено (RX=%d TX=%d %lu бод)%s\n", rx, tx, (unsigned long)baud,
                v % 2 ? " — дроти TX/RX переплутані, але працює" : "");
  if (prefs.getUChar("gsmV", 0) != v) prefs.putUChar("gsmV", v);
  gsmCmd("ATE0", "OK", 500);
  gsmCmd("AT+CMGF=1", "OK", 1000);          // SMS текстом
  gsmCmd("AT+CSCS=\"GSM\"", "OK", 1000);
  diagDirty = true;
}

// Стан SIM800L: SIM, мережа, сигнал. Кожна команда відповідає за ~50 мс.
void gsmStatus() {
  String r;
  bool sim = gsmCmd("AT+CPIN?", "OK", 500, &r) && r.indexOf("READY") >= 0;
  bool reg = false;
  if (gsmCmd("AT+CREG?", "OK", 500, &r)) {
    int i = r.indexOf("+CREG:");
    if (i >= 0) { int c = r.indexOf(',', i); int st = c > 0 ? r.substring(c + 1).toInt() : 0; reg = st == 1 || st == 5; }
  }
  int csq = 99;
  if (gsmCmd("AT+CSQ", "OK", 500, &r)) {
    int i = r.indexOf("+CSQ:");
    if (i >= 0) csq = r.substring(i + 5).toInt();
  }
  if (r.length() == 0 && !sim) { gsmOk = false; Serial.println("SIM800L: зник"); diagDirty = true; return; }
  if (sim != gsmSim || reg != gsmReg || abs(csq - gsmCsq) >= 3) {
    Serial.printf("SIM800L: SIM=%s, мережа=%s, сигнал=%d/31\n", sim ? "OK" : "немає/PIN", reg ? "так" : "ні", csq);
    diagDirty = true;
  }
  gsmSim = sim; gsmReg = reg; gsmCsq = csq;
}

// Викликається з loop(): шукає модем, оновлює стан, ловить кінець дзвінка
void gsmPoll() {
  static uint32_t last = 0;
  if (sosCalling) {                                   // під час дзвінка лише слухаємо
    static String buf;
    while (Serial2.available()) buf += (char)Serial2.read();
    if (buf.indexOf("NO CARRIER") >= 0 || buf.indexOf("BUSY") >= 0 || buf.indexOf("NO ANSWER") >= 0) {
      sosCalling = false; Serial.println("SOS: дзвінок завершено");
    }
    if (buf.length() > 200) buf = buf.substring(buf.length() - 50);
    return;
  }
  if (recording) return;
  // Модем не знайдено: перші 10 спроб (усі варіанти) раз на 5 с, далі раз на хвилину — пристрій може працювати й без SIM800L
  static uint8_t misses = 0;
  uint32_t every = gsmOk ? 30000 : (misses < 10 ? 5000 : 60000);
  if (millis() - last < every) return;
  last = millis();
  if (!gsmOk) { gsmProbe(); misses = gsmOk ? 0 : (misses < 255 ? misses + 1 : misses); }
  if (gsmOk) gsmStatus();
}

void triggerSos() {
  char phone[24], name[32];
  xSemaphoreTake(sosMutex, portMAX_DELAY);
  strlcpy(phone, sosPhone, sizeof(phone)); strlcpy(name, sosName, sizeof(name));
  xSemaphoreGive(sosMutex);
  double lat = gpsFix() ? gps.location.lat() : NAN, lon = gpsFix() ? gps.location.lng() : NAN;
  bool called = false;

  sosShownUntil = millis() + 15000;
  if (gsmOk && gsmReg && phone[0]) {
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
//                        Кнопка 3: точка на карті
// =====================================================================
void pointAdd() {
  double lat, lon;
  if (!bestFix(lat, lon)) { toast("Немає GPS", "точку не поставлено", 3000); return; }
  pointSeq++; pointAt = millis();
  Job j{}; j.type = JOB_POINT; j.lat = lat; j.lon = lon; j.pointSeq = pointSeq;
  j.rms = sensorOk ? ringRms(RING_N) : NAN;
  strlcpy(j.sev, roadSeverity(), sizeof(j.sev));
  queueJob(j);
  const char* sv = !strcmp(j.sev, "bad") ? "погано" : !strcmp(j.sev, "warning") ? "нерівно" : "рівно";
  toast("Точка " + String(pointSeq) + " " + sv, "1 = голос до неї", 4000);
  char ev[180];
  snprintf(ev, sizeof(ev), "{\"type\":\"point\",\"n\":%u,\"lat\":%.6f,\"lon\":%.6f,\"sev\":\"%s\",\"sent\":false}", pointSeq, lat, lon, j.sev);
  mqttEvent(ev);
}

// =====================================================================
//                     GPS-трек зі станом дороги
// =====================================================================
void trackTick() {
  static uint32_t last = 0;
  if (gpsFix()) { fixLat = gps.location.lat(); fixLon = gps.location.lng(); fixMs = millis(); }
  if (millis() - last < TRACK_EVERY_MS) return;
  last = millis();
  if (!gpsFix()) return;
  double lat = gps.location.lat(), lon = gps.location.lng();
  if (!isnan(trackLastLat) && TinyGPSPlus::distanceBetween(lat, lon, trackLastLat, trackLastLon) < TRACK_MIN_MOVE_M) return;
  trackLastLat = lat; trackLastLon = lon;
  if (trackCount == TRACK_CAP) {
    if (trackInFlight >= trackCount) return;          // усе вже надсилається — нову точку пропускаємо
    trackHead = (trackHead + 1) % TRACK_CAP; trackCount--;   // найстаріша точка, що не надсилається
    if (trackInFlight) trackInFlight--;               // (у пачці лишаться ті самі точки, просто без першої)
  }
  TrackPt& t = track[(trackHead + trackCount) % TRACK_CAP];
  t.lat = lat; t.lon = lon; t.ms = millis();
  t.rmsMg = sensorOk ? (int16_t)min(30000L, lroundf(ringRms(30) * 1000)) : -1;   // за останні 3 с
  trackCount++;
}

void trackSend() {
  static uint32_t last = 0;
  if (trackInFlight || !trackCount || WiFi.status() != WL_CONNECTED) return;
  if (trackCount < TRACK_BATCH && millis() - last < TRACK_SEND_MS) return;
  last = millis();
  uint16_t n = min((uint16_t)TRACK_BATCH, trackCount);
  String js; js.reserve(n * 42 + 4);
  js = "[";
  for (uint16_t i = 0; i < n; i++) {
    const TrackPt& t = track[(trackHead + i) % TRACK_CAP];
    char b[64];
    snprintf(b, sizeof(b), "%s[%.6f,%.6f,", i ? "," : "", t.lat, t.lon);
    js += b;
    if (t.rmsMg < 0) js += "null"; else { snprintf(b, sizeof(b), "%.3f", t.rmsMg / 1000.0f); js += b; }
    snprintf(b, sizeof(b), ",%lu]", (unsigned long)((millis() - t.ms) / 1000));
    js += b;
  }
  js += "]";
  char* mem = strdup(js.c_str());
  if (!mem) return;
  Job j{}; j.type = JOB_TRACK; j.mem = (uint8_t*)mem; j.n = n;
  if (xQueueSend(jobQ, &j, 0) != pdTRUE) { free(mem); return; }
  trackInFlight = n;
}

// =====================================================================
//                            Обробка відліку
// =====================================================================
void sendBatch() {
  float rms = sqrtf(sumSq / BATCH);
  lastRms = rms;
  ringSq[ringHead] = rms * rms; ringPk[ringHead] = peak;
  ringHead = (ringHead + 1) % RING_N; if (ringFill < RING_N) ringFill++;
  bool bump = (peak >= BUMP_G) && (millis() - lastBumpMs > 700);
  if (bump) { lastBumpMs = millis(); bumpLedUntil = millis() + 200; }

  static char buf[900];
  int p = snprintf(buf, sizeof(buf), "{\"seq\":%lu,\"t\":%lu,\"hz\":%d,\"a\":[", (unsigned long)seq++, (unsigned long)millis(), SAMPLE_HZ);
  for (int i = 0; i < BATCH; i++) p += snprintf(buf + p, sizeof(buf) - p, i ? ",%d" : "%d", batchBuf[i]);
  p += snprintf(buf + p, sizeof(buf) - p, "],\"rms\":%.3f,\"pk\":%.3f,\"bump\":%d,\"mark\":0,\"bat\":%.2f,\"rec\":%d,\"pt\":%u",
                rms, peak, bump ? 1 : 0, batteryV(), recording ? 1 : 0, pointActive() ? pointSeq : 0);
  if (gpsFix())
    p += snprintf(buf + p, sizeof(buf) - p, ",\"lat\":%.6f,\"lon\":%.6f,\"spd\":%.1f,\"sat\":%d",
                  gps.location.lat(), gps.location.lng(), gps.speed.kmph(), (int)gps.satellites.value());
  else
    p += snprintf(buf + p, sizeof(buf) - p, ",\"sat\":%d", (int)gps.satellites.value());
  snprintf(buf + p, sizeof(buf) - p, "}");
  if (mqtt.connected()) mqtt.publish(MQTT_TOPIC, buf);

  static uint8_t k = 0;
  if (++k % 50 == 0) {
    Serial.printf("rms=%.3f mqtt=%d wifi=%d gps=%d sat=%d bad=%lu rec=%d точок=%u трек=%u/%lu heap=%u\n", rms, mqtt.connected(),
                  WiFi.status() == WL_CONNECTED, gpsFix(), (int)gps.satellites.value(), (unsigned long)badReads, recording,
                  pointSeq, trackCount, (unsigned long)trackSaved, ESP.getFreeHeap());
    badReads = 0;
  }
  batchN = 0; sumSq = 0; peak = 0;
}

void onSample(float av) {
  batchBuf[batchN++] = (int16_t)lroundf(av * 1000.0f);
  sumSq += av * av;
  if (fabsf(av) > peak) peak = fabsf(av);
  if (batchN >= BATCH) sendBatch();
}

// =====================================================================
//                                Екран
// =====================================================================
void drawScreen() {
  if (!screenOk()) return;
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
    else l2 = !gsmOk ? "Пішло на сайт" : !gsmReg ? "Немає GSM" : "Не подзвонив";
  } else if (recording) {
    uint32_t s = (millis() - recStart) / 1000;
    char t[24]; snprintf(t, sizeof(t), "%lu:%02lu", (unsigned long)(s / 60), (unsigned long)(s % 60));
    l1 = String((millis() / 500) % 2 ? "* " : "  ") + (recPointSeq ? "Точка " + String(recPointSeq) + " " : String("Запис ")) + t;
    l2 = recToRam ? "Стоп: 2 (макс " + String((ramCap - 44) / REC_RATE_OUT) + " с)" : String("Стоп: кнопка 2");
  } else if (millis() < toastUntil) {
    l1 = toast1; l2 = toast2;
  } else {
    int idx = min(100, (int)lroundf(lastRms / 0.35f * 100));
    const char* lvl = lastRms < 0.06f ? "Рівно" : lastRms < 0.14f ? "Нерівно" : lastRms < 0.25f ? "Погано" : "Дуже погано";
    l1 = String(WiFi.status() == WL_CONNECTED ? (mqtt.connected() ? "Онлайн" : "Wi-Fi") : "Офлайн") +
         " GPS" + (gpsFix() ? String((int)gps.satellites.value()) : String("-"));
    float v = batteryV();
    if (v > 2.5f) l1 += " " + String(constrain((int)((v - 3.3f) / 0.9f * 100), 0, 100)) + "%";
    l2 = sensorOk ? String(lvl) + " " + idx : String("Датчик мовчить");
    if (batLow && (millis() / 3000) % 2) l2 = "Зарядіть акум.";
    if (pointActive()) l2 = "Точка " + String(pointSeq) + " 1=голос";
    else if (pointSeq) l2 += " Т" + String(pointSeq);
  }

  static String p1, p2;
  if (l1 == p1 && l2 == p2 && !recording && !oledFresh) return;
  oledFresh = false;
  p1 = l1; p2 = l2;
  screenShow(l1, l2);
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
      if (i == 2) pointAdd();
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
      case RES_POINT_OK:
        pointsSent++;
        snprintf(ev, sizeof(ev), "{\"type\":\"point\",\"n\":%u,\"id\":\"%s\",\"lat\":%s,\"lon\":%s,\"sev\":\"%s\",\"sent\":true}",
                 r.n, r.id, fmtCoord(r.lat).c_str(), fmtCoord(r.lon).c_str(), r.sev);
        mqttEvent(ev);
        if (!recording) toast("Точка " + String(r.n) + " на карті", pointActive() ? "1 = голос до неї" : "");
        break;
      case RES_POINT_FAIL: toast("Точка " + String(r.n), "не дійшла на сайт"); break;
      case RES_TRACK_OK:
        for (uint16_t k = 0; k < r.n && trackCount; k++) { trackHead = (trackHead + 1) % TRACK_CAP; trackCount--; }
        trackSaved += r.n; trackInFlight = 0;
        break;
      case RES_TRACK_FAIL: trackInFlight = 0; Serial.println("Трек не надіслано, спробую ще"); break;
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

// SD-картка не знайшлась (погано вставлена чи відійшов дріт) — пробуємо знову раз на 10 с
void sdWatch() {
  static uint32_t last = 0;
  if (sdOk || recording || voiceInFlight > 0 || millis() - last < 10000) return;
  last = millis();
  if (xSemaphoreTake(sdMutex, 0) != pdTRUE) return;
  SD.end();
  sdOk = SD.begin(PIN_SD_CS);
  if (sdOk && !SD.exists("/rec")) SD.mkdir("/rec");
  xSemaphoreGive(sdMutex);
  if (sdOk) { diagDirty = true; Serial.println("SD: знайшлась"); toast("SD-картка", "знайшлась"); }
}

void retryFailedNotes() {
  static uint32_t last = 0;
  if (millis() - last < 120000 || WiFi.status() != WL_CONNECTED || voiceInFlight > 0) return;
  last = millis();
  if (sdOk && !recording) queuePendingNotes();
}

// Низький заряд: лише попереджаємо (екран, сайт). Пристрій НЕ присипляємо: дільник на GPIO34
// буває не підключений або міряє не те (живлення через TP4056 + MT3608), і хибне «розряджено»
// вимикало пристрій через 10 с. Акумулятор від переразряду захищає плата TP4056 (DW01).
void checkBattery() {
  static uint32_t lowSince = 0, lastCheck = 0;
  if (millis() - lastCheck < 1000) return;
  lastCheck = millis();
  float v = batteryV();
  bool low = v >= 2.8f && v < BATT_CUTOFF;          // нижче 2.8 В — дільника, схоже, немає
  if (!low) { lowSince = 0; if (batLow) { batLow = false; Serial.printf("Акумулятор: %.2f В, норма\n", v); } return; }
  if (!lowSince) lowSince = millis();
  if (!batLow && millis() - lowSince > 30000) {
    batLow = true;
    Serial.printf("Акумулятор сідає: %.2f В\n", v);
    toast("Акумулятор сідає", String(v, 2) + " V, зарядіть", 5000);
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
  // Перевірка світлодіода: червоний, зелений, синій по 0.3 с. Якщо якийсь колір не світиться —
  // дивись його резистор і дріт (R=13, G=4, B=2); не світиться жоден — спільна ніжка не на GND.
  led(1, 0, 0); delay(300); led(0, 1, 0); delay(300); led(0, 0, 1); delay(300);
  led(1, 1, 0);
  prefs.begin("rivnohid", false);
  sosMutex = xSemaphoreCreateMutex();
  sdMutex = xSemaphoreCreateMutex();
  strlcpy(sosPhone, prefs.getString("sos", "").c_str(), sizeof(sosPhone));
  jobQ = xQueueCreate(12, sizeof(Job));
  resQ = xQueueCreate(12, sizeof(Result));

  Wire.begin(PIN_SDA, PIN_SCL, 100000);
  Wire.setTimeOut(50);
  delay(100);                                          // дешеві SSD1306 прокидаються після ESP32
  i2cScan();
  if (screenTryInit()) screenShow("Рівнохід", "Запуск...");
  else Serial.println("Екран не знайдено (OLED 0x3C/0x3D, LCD 0x27/0x3F): перевір VCC/GND/SDA/SCL");

  sdOk = SD.begin(PIN_SD_CS);
  Serial.println(sdOk ? "SD: OK" : "SD: немає картки");
  if (sdOk && !SD.exists("/rec")) SD.mkdir("/rec");

  micProbe();
  xTaskCreatePinnedToCore(micTask, "mic", 4096, nullptr, 3, nullptr, 1);
  gsmProbe();                                          // якщо модем ще прокидається, gsmPoll() знайде його пізніше
  if (gsmOk) gsmStatus();
  Serial1.begin(9600, SERIAL_8N1, PIN_GPS_RX, -1);

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(15);
  screenShow("Шукаю Wi-Fi...");
  ensureWifi();
  ensureMqtt();

  xTaskCreatePinnedToCore(netTask, "net", 16384, nullptr, 1, nullptr, 0);
  Job hello{}; hello.type = JOB_HELLO; queueJob(hello);
  if (sdOk) queuePendingNotes();

  sensorOk = mpuInit();
  screenShow("Калібрування", "не рухай 2 с");
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
  trackTick();
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
  trackSend();
  screenWatch();
  sdWatch();
  gsmPoll();
  drawScreen();

  // Світлодіод
  if (millis() < sosShownUntil)        led((millis() / 200) % 2, 0, 0);
  else if (recording)                  led((millis() / 400) % 2, 0, (millis() / 400) % 2);
  else if (!sensorOk)                  led((millis() / 300) % 2, 0, 0);
  else if (millis() < bumpLedUntil)    led(0, 0, 1);
  else if (mqtt.connected())           led(0, 1, 0);
  else                                 led(1, 1, 0);
}
