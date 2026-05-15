import { z } from "zod";

export const sqliteBool = z
  .union([z.literal(0), z.literal(1), z.boolean()])
  .transform((v) => v === 1 || v === true);

export const SeedlingDataSchema = z.object({
  luxLvl: z.number().default(-1),
  tempLvl: z.number().default(-1),
  moistureLvl: z.number().default(-1),
  waterLvl: z.string().default("Unknown"),
  waterRawADC: z.number().optional(),
  isLightOn: sqliteBool,
  isFanOn: sqliteBool,
  isFan2On: sqliteBool.optional(),
  isMistingOn: sqliteBool,
  fanBoost: sqliteBool.optional(),
  fanCyclePos: z.number().int().optional(),
  mode: z.enum(["auto", "manual"]),
  phase: z.enum(["germination", "nursery"]),
  nurseryDay: z.number().int().optional(),
  wifiOK: sqliteBool.optional(),
  ntpOK: sqliteBool.optional(),
  shtError: sqliteBool.optional(),
  luxError: sqliteBool.optional(),
  germHumidAlarm: sqliteBool.optional(),
  waterLvlAlarm: sqliteBool.optional(),
  germRemainingSeconds: z.number().optional(),
});

export type SeedlingData = z.infer<typeof SeedlingDataSchema>;
