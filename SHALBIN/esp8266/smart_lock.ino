#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <Keypad.h>
#include <WiFiManager.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <MFRC522.h>
#include <SPI.h>

// RFID pins
#define RST_PIN D0
#define SS_PIN D10
MFRC522 rfid(SS_PIN, RST_PIN);

// PIN for relay control
const int relayPin = D1;

// EEPROM configuration
#define EEPROM_SIZE 512
#define CONFIG_MARKER 0xAB  // Magic byte to check if EEPROM is initialized

// Security settings
const int MAX_ATTEMPTS = 3;
const unsigned long COOLDOWN_TIME = 60000; // 1 minute in milliseconds
const char* EMERGENCY_PIN = "147258"; // Emergency PIN for offline access

// Allowed RFID card UIDs (hex format)
const byte ALLOWED_CARDS[][4] = {
  {0x12, 0x34, 0x56, 0x78}, // Example card 1
  {0xAB, 0xCD, 0xEF, 0x12}  // Example card 2
};

// Configuration data structure
struct ConfigData {
  byte marker;             // Used to check if EEPROM is initialized
  char lockId[32];         // Lock ID
  char serverUrl[80];      // Server URL
  bool permanentlyLocked;  // Permanent lock status
  int failedAttempts;     // Number of failed attempts
  unsigned long lockoutTime; // Time when lockout started
};

// Default settings
const char* defaultLockId = "67d19deabe5bc0f26064415b";
const char* defaultServerUrl = "http://192.168.1.6:5000/api/verify-otp";

// Global variables
ConfigData config;
String currentInput = "";
const int PIN_LENGTH = 6;
bool isInCooldown = false;
unsigned long cooldownStartTime = 0;

// Keypad configuration
const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};

byte rowPins[ROWS] = {D2, D3, D4, D5};
byte colPins[COLS] = {D6, D7, D8, D9};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// WiFiManager and configuration web server
WiFiManager wifiManager;
ESP8266WebServer server(80);

bool shouldSaveConfig = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\nDoor Lock System Starting...");
  
  // Initialize SPI and RFID
  SPI.begin();
  rfid.PCD_Init();
  
  pinMode(relayPin, OUTPUT);
  digitalWrite(relayPin, LOW);
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Load configuration
  if (!loadConfiguration()) {
    Serial.println("Using default configuration");
    setDefaultConfiguration();
    saveConfiguration();
  }
  
  // Set up WiFiManager
  configureWiFiManager();
  
  // Set up configuration web server
  setupConfigWebServer();
  
  Serial.println("\nSystem ready. Enter 6-digit PIN or scan RFID card:");
  printSystemStatus();
}

void printSystemStatus() {
  Serial.print("Lock ID: ");
  Serial.println(config.lockId);
  Serial.print("Server URL: ");
  Serial.println(config.serverUrl);
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.print("Permanently Locked: ");
  Serial.println(config.permanentlyLocked ? "Yes" : "No");
  Serial.print("Failed Attempts: ");
  Serial.println(config.failedAttempts);
}

bool isRFIDCardAllowed(MFRC522::Uid uid) {
  for (size_t i = 0; i < sizeof(ALLOWED_CARDS) / sizeof(ALLOWED_CARDS[0]); i++) {
    if (memcmp(uid.uidByte, ALLOWED_CARDS[i], 4) == 0) {
      return true;
    }
  }
  return false;
}

void unlockDoor() {
  digitalWrite(relayPin, HIGH);
  Serial.println("Door unlocked!");
  delay(5000);
  digitalWrite(relayPin, LOW);
  Serial.println("Door locked!");
}

void handleFailedAttempt() {
  config.failedAttempts++;
  saveConfiguration();
  
  if (config.failedAttempts >= MAX_ATTEMPTS) {
    isInCooldown = true;
    cooldownStartTime = millis();
    
    // Notify server about unauthorized attempts
    if (WiFi.status() == WL_CONNECTED) {
      notifyServer("unauthorized_attempt");
    }
  }
  
  Serial.print("Failed attempts: ");
  Serial.println(config.failedAttempts);
}

void resetFailedAttempts() {
  config.failedAttempts = 0;
  isInCooldown = false;
  saveConfiguration();
}

void notifyServer(const char* event) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  
  String url = String(config.serverUrl).substring(0, String(config.serverUrl).lastIndexOf('/'));
  url += "/notify";
  
  if (http.begin(client, url)) {
    http.addHeader("Content-Type", "application/json");
    
    DynamicJsonDocument doc(256);
    doc["lockId"] = config.lockId;
    doc["event"] = event;
    
    String requestBody;
    serializeJson(doc, requestBody);
    
    int httpCode = http.POST(requestBody);
    if (httpCode > 0) {
      Serial.printf("Server notified: %s\n", event);
    }
    http.end();
  }
}

void verifyCode(String lockId, String code) {
  // Check for permanent lock
  if (config.permanentlyLocked) {
    Serial.println("Device is permanently locked!");
    return;
  }
  
  // Check for emergency PIN when offline
  if (WiFi.status() != WL_CONNECTED && code == EMERGENCY_PIN) {
    Serial.println("Emergency PIN accepted!");
    unlockDoor();
    resetFailedAttempts();
    return;
  }
  
  // Check cooldown period
  if (isInCooldown) {
    unsigned long elapsed = millis() - cooldownStartTime;
    if (elapsed < COOLDOWN_TIME) {
      Serial.printf("In cooldown. Wait %d seconds\n", (COOLDOWN_TIME - elapsed) / 1000);
      return;
    }
    isInCooldown = false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Only emergency PIN and RFID allowed.");
    handleFailedAttempt();
    return;
  }

  WiFiClient client;
  HTTPClient http;

  Serial.println("\nSending request to server:");
  Serial.println("URL: " + String(config.serverUrl));
  Serial.println("Lock ID: " + lockId);
  Serial.println("Code: " + code);

  if (!http.begin(client, config.serverUrl)) {
    Serial.println("Failed to connect to server");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  DynamicJsonDocument doc(256);
  doc["lockId"] = lockId;
  doc["code"] = code;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  Serial.println("HTTP Response code: " + String(httpCode));

  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("Response body: " + response);

    if (httpCode == HTTP_CODE_OK) {
      DynamicJsonDocument responseDoc(256);
      DeserializationError error = deserializeJson(responseDoc, response);
      
      if (!error && responseDoc["success"]) {
        Serial.println("Success: Code verified!");
        unlockDoor();
        resetFailedAttempts();
      } else {
        Serial.println("Error: Invalid code");
        handleFailedAttempt();
      }
    } else {
      Serial.println("Error: Server returned error code");
      handleFailedAttempt();
    }
  } else {
    Serial.printf("Error: HTTP connection failed, error: %s\n", http.errorToString(httpCode).c_str());
    handleFailedAttempt();
  }

  http.end();
}

void processKey(char key) {
  if (key) {
    Serial.print("Key pressed: ");
    Serial.println(key);
  }

  if (config.permanentlyLocked) {
    Serial.println("Device is permanently locked!");
    return;
  }

  if (key >= '0' && key <= '9') {
    if (currentInput.length() < PIN_LENGTH) {
      currentInput += key;
      Serial.print("*");

      if (currentInput.length() == PIN_LENGTH) {
        Serial.println("\nVerifying code...");
        verifyCode(config.lockId, currentInput);
        currentInput = "";
        Serial.println("\nEnter 6-digit PIN or scan RFID card:");
      }
    }
  } else if (key == '*') {
    currentInput = "";
    Serial.println("\nInput cleared. Enter 6-digit PIN or scan RFID card:");
  } else if (key == '#') {
    if (currentInput.length() > 0) {
      Serial.println("\nForce verifying code...");
      verifyCode(config.lockId, currentInput);
      currentInput = "";
      Serial.println("\nEnter 6-digit PIN or scan RFID card:");
    }
  } else if (key == 'C') {
    Serial.println("\nEntering configuration mode...");
    wifiManager.startConfigPortal("DoorLock-Setup");
    Serial.println("Connected to WiFi");
    Serial.println("\nEnter 6-digit PIN or scan RFID card:");
  }
}

void handleRoot() {
  String html = "<html><head><title>Door Lock Configuration</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:Arial,sans-serif;margin:20px;} "
          ".button{background-color:#4CAF50;border:none;color:white;padding:10px 20px;text-align:center;"
          "text-decoration:none;display:inline-block;font-size:16px;margin:4px 2px;cursor:pointer;border-radius:4px;} "
          ".danger{background-color:#f44336;} .warning{background-color:#ff9800;}</style>";
  html += "</head><body>";
  html += "<h1>Door Lock Configuration</h1>";
  html += "<p><strong>Connected to WiFi:</strong> " + WiFi.SSID() + "</p>";
  html += "<p><strong>Signal Strength:</strong> " + String(WiFi.RSSI()) + " dBm</p>";
  html += "<p><strong>IP Address:</strong> " + WiFi.localIP().toString() + "</p>";
  html += "<p><strong>Lock ID:</strong> " + String(config.lockId) + "</p>";
  html += "<p><strong>Server URL:</strong> " + String(config.serverUrl) + "</p>";
  html += "<p><strong>Lock Status:</strong> " + String(config.permanentlyLocked ? "Permanently Locked" : "Normal") + "</p>";
  html += "<p><strong>Failed Attempts:</strong> " + String(config.failedAttempts) + "</p>";
  
  if (!config.permanentlyLocked) {
    html += "<p><a href='/lock' class='button danger' onclick='return confirm(\"Are you sure you want to permanently lock the device?\");'>Permanently Lock Device</a></p>";
  } else {
    html += "<p><a href='/unlock' class='button warning' onclick='return confirm(\"Are you sure you want to unlock the device?\");'>Remove Permanent Lock</a></p>";
  }
  
  html += "<p><a href='/config' class='button'>Edit Configuration</a></p>";
  html += "<p><a href='/reset' class='button danger' onclick='return confirm(\"Are you sure? This will erase all settings!\");'>Factory Reset</a></p>";
  html += "<p><a href='/resetattempts' class='button warning'>Reset Failed Attempts</a></p>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleLock() {
  config.permanentlyLocked = true;
  saveConfiguration();
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "");
}

void handleUnlock() {
  config.permanentlyLocked = false;
  saveConfiguration();
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "");
}

void handleResetAttempts() {
  resetFailedAttempts();
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "");
}

void setupConfigWebServer() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/config", HTTP_GET, handleConfig);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/reset", HTTP_GET, handleReset);
  server.on("/lock", HTTP_GET, handleLock);
  server.on("/unlock", HTTP_GET, handleUnlock);
  server.on("/resetattempts", HTTP_GET, handleResetAttempts);
  
  server.begin();
  Serial.println("Configuration web server started");
}

void loop() {
  server.handleClient();
  
  // Handle keypad input
  char key = keypad.getKey();
  if (key) {
    processKey(key);
  }
  
  // Handle RFID
  if (!config.permanentlyLocked && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print("RFID Card detected: ");
    for (byte i = 0; i < rfid.uid.size; i++) {
      Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
      Serial.print(rfid.uid.uidByte[i], HEX);
    }
    Serial.println();
    
    if (isRFIDCardAllowed(rfid.uid)) {
      Serial.println("Authorized RFID card");
      unlockDoor();
      resetFailedAttempts();
    } else {
      Serial.println("Unauthorized RFID card");
    }
    
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
  
  // Check and update cooldown status
  if (isInCooldown && (millis() - cooldownStartTime >= COOLDOWN_TIME)) {
    isInCooldown = false;
    Serial.println("Cooldown period ended");
  }
  
  delay(10);
}