import { getPreferenceValues } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import type { Meetup } from "./types";

interface Preferences {
  cliPath?: string;
}

const execFileAsync = promisify(execFile);
const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultCliScriptPath = resolve(currentDir, "../../../../dist/cli.mjs");

function getCliScriptPath(): string {
  const preferences = getPreferenceValues<Preferences>();
  const configuredPath = preferences.cliPath?.trim();
  if (configuredPath) {
    return configuredPath;
  }

  return defaultCliScriptPath;
}

async function runCliJson<T>(args: string[]): Promise<T> {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [getCliScriptPath(), ...args],
      {
        timeout: 10000,
      },
    );

    return JSON.parse(stdout) as T;
  } catch (error) {
    if (typeof error === "object" && error && "stderr" in error) {
      const stderr = String(error.stderr || "").trim();
      if (stderr) {
        throw new Error(stderr);
      }
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(String(error));
  }
}

export function useMeetup(selector: string) {
  return usePromise(
    (target: string) => runCliJson<Meetup>(["view", target, "--json"]),
    [selector],
    {
      failureToastOptions: {
        title: "Could not load meetup",
        message: "Check the Coders.mu CLI path in the extension preferences.",
      },
    },
  );
}

export function useMeetups() {
  return usePromise(
    () => runCliJson<Meetup[]>(["list", "--state", "all", "--json"]),
    [],
    {
      failureToastOptions: {
        title: "Could not load meetups",
        message: "Check the Coders.mu CLI path in the extension preferences.",
      },
    },
  );
}
