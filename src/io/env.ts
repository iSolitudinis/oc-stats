import { homedir } from "node:os";
import { join } from "node:path";

export function getDataDir(): string {
  return join(homedir(), ".local", "share", "opencode", "storage");
}
