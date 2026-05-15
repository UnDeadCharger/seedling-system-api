CREATE TABLE IF NOT EXISTS SeedlingHistory (
    id                   INTEGER PRIMARY KEY,
 
    -- Sensor readings
    luxLvl               NUMBER  NOT NULL,
    tempLvl              NUMBER  NOT NULL,
    moistureLvl          NUMBER  NOT NULL,
    waterLvl             TEXT    NOT NULL,
    waterRawADC          NUMBER,                   -- raw ADC value from water sensor
 
    -- Actuator states
    isLightOn            BOOLEAN NOT NULL,
    isFanOn              BOOLEAN NOT NULL,
    isFan2On             BOOLEAN,                  -- second fan
    isMistingOn          BOOLEAN NOT NULL,
    fanBoost             BOOLEAN,                  -- fan boost mode active
    fanCyclePos          INTEGER,                  -- position in the fan duty cycle
 
    -- Mode / phase
    mode                 TEXT    CHECK(mode  IN ('auto', 'manual')) NOT NULL,
    phase                TEXT    CHECK(phase IN ('germination', 'nursery')),
    nurseryDay           INTEGER,                  -- current day within nursery phase
 
    -- Connectivity
    wifiOK               BOOLEAN,
    ntpOK                BOOLEAN,
 
    -- Error / alarm flags
    shtError             BOOLEAN,                  -- SHT sensor (temp/humidity) error
    luxError             BOOLEAN,
    germHumidAlarm       BOOLEAN,                  -- was germHudmidAlarm (typo fixed)
    waterLvlAlarm        BOOLEAN,
 
    -- Germination countdown
    germRemainingSeconds NUMBER,
 
    receivedAt           DATETIME DEFAULT CURRENT_TIMESTAMP
);
 
CREATE INDEX IF NOT EXISTS idx_receivedAt ON SeedlingHistory (receivedAt);

CREATE TABLE CommandQueue (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  cmd       TEXT NOT NULL,
  params    TEXT,              -- JSON string
  cmdStatus TEXT DEFAULT 'pending', -- pending | sent
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commandqueue_status ON CommandQueue(cmdStatus);
 
-- Sample row
INSERT INTO SeedlingHistory (
    luxLvl, tempLvl, moistureLvl, waterLvl,
    isLightOn, isFanOn, isMistingOn,
    mode, phase
) VALUES (
    1000, 25, 60, 'Full',
    1, 0, 0,
    'auto', 'germination'
);
