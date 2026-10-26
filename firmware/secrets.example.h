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

// Supabase сайту: Project Settings -> API (URL без https:// і публічний anon key)
const char* SUPABASE_HOST     = "xxxxxxxxxxxxxxxxxxxx.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJ...";

// Токен пристрою. У таблиці devices зберігається sha256(токен):
//   printf %s "$TOKEN" | sha256sum
const char* DEVICE_TOKEN = "rvh_CHANGE_ME";
