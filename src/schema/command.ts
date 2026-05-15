import { z } from "zod";

import { DeviceCommand } from "../types";

const SetPhaseSchema = z.object({
  cmd: z.literal(DeviceCommand.SetPhase),
  params: z.object({ phase: z.enum(["germination", "nursery"]) }),
});

const SetModeSchema = z.object({
  cmd: z.literal(DeviceCommand.SetMode),
  params: z.object({ mode: z.enum(["auto", "manual"]) }),
});

const ManualRunSchema = z.object({
  cmd: z.literal(DeviceCommand.ManualRun),
  params: z.object({
    light: z.number().int().min(0).optional(),
    fan: z.number().int().min(0).optional(),
    mist: z.number().int().min(0).optional(),
  }),
});

const StopSchema = z.object({
  cmd: z.literal(DeviceCommand.Stop),
  params: z.object({}).optional(),
});

const RebootSchema = z.object({
  cmd: z.literal(DeviceCommand.Reboot),
  params: z.object({}).optional(),
});

export const CommandSchema = z.discriminatedUnion("cmd", [
  SetPhaseSchema,
  SetModeSchema,
  ManualRunSchema,
  StopSchema,
  RebootSchema,
]);

export type CommandInput = z.infer<typeof CommandSchema>;
