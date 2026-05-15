export interface Env {
  DB: D1Database;
  API_KEY: string;
}

export enum DeviceCommand {
  SetPhase = "set_phase",
  SetMode = "set_mode",
  ManualRun = "manual_run",
  Stop = "stop",
  Reboot = "reboot",
}

export type Phase = "germination" | "nursery";
export type Mode = "auto" | "manual";

export interface CommandPayload {
  [DeviceCommand.SetPhase]: { phase: Phase };
  [DeviceCommand.SetMode]: { mode: Mode };
  [DeviceCommand.ManualRun]: { light?: number; fan?: number; mist?: number };
  [DeviceCommand.Stop]: Record<string, never>;
  [DeviceCommand.Reboot]: Record<string, never>;
}

export type CommandEntry<C extends DeviceCommand = DeviceCommand> = {
  cmd: C;
  params: CommandPayload[C];
};
