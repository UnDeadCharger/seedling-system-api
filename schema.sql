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
    mode TEXT CHECK(mode IN ('Auto', 'Manual')) NOT NULL,
    phase TEXT CHECK(phase IN ('Germination', 'Nursery')),
    isSystemOn BOOLEAN NOT NULL,
    receivedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_receivedAt ON SeedlingHistory (receivedAt);
INSERT INTO SeedlingHistory (luxLvl, tempLvl, moistureLvl, waterLvl, isLightOn, isFanOn, isMistingOn, mode, phase, isSystemOn) VALUES (1000, 25, 60, 'Normal', 1, 0, 1, 'Auto', 'Germination', 1);

--  Lux, Temp, Moisture Level, Water Level
-- - Light (on/off), Fan (on/off), Misting (on/off)
-- - Mode (Auto, Manual), Status (on/off)