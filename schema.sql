DROP TABLE IF EXISTS Customers;
DROP TABLE IF EXISTS SeedlingHistory;
CREATE TABLE IF NOT EXISTS SeedlingHistory (
    id INTEGER PRIMARY KEY, 
    luxLvl NUMBER NOT NULL, 
    tempLvl NUMBER NOT NULL,
    moistureLvl NUMBER NOT NULL,
    waterLvl TEXT NOT NULL,
    isLightOn BOOLEAN NOT NULL,
    isFanOn BOOLEAN NOT NULL,
    isMistingOn BOOLEAN NOT NULL,
    mode TEXT CHECK(mode IN ('auto', 'manual')) NOT NULL,
    phase TEXT CHECK(phase IN ('germination', 'nursery')),
    dhtError BOOLEAN,
    luxError BOOLEAN,
    germHudmidAlarm BOOLEAN,
    waterLvlAlarm BOOLEAN,
    germRemainingSeconds NUMBER,
    receivedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_receivedAt ON SeedlingHistory (receivedAt);
INSERT INTO SeedlingHistory (luxLvl, tempLvl, moistureLvl, waterLvl, isLightOn, isFanOn, isMistingOn, mode, phase) VALUES (1000, 25, 60, 'Full', 1, 0, 0, 'auto', 'germination');
--  Lux, Temp, Moisture Level, Water Level
-- - Light (on/off), Fan (on/off), Misting (on/off)
-- - Mode (Auto, Manual), Status (on/off)