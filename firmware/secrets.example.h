#pragma once
// Скопіюй цей файл у secrets.h (він у .gitignore) і впиши свої дані.
// ESP32 підключається лише до мереж 2.4 ГГц. Пристрій сам обере найсильнішу з цих мереж.

struct WifiCred { const char* ssid; const char* pass; };

const WifiCred WIFI_NETWORKS[] = {
  {"HOME_WIFI_2_4GHZ", "HOME_PASSWORD"},
  {"PHONE_HOTSPOT",    "HOTSPOT_PASSWORD"},   // для роботи на вулиці
};

// Пароль для оновлення прошивки по Wi-Fi (Arduino IDE спитає його при завантаженні)
const char* OTA_PASSWORD = "CHANGE_ME";
