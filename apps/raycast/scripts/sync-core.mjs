import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionDir = resolve(scriptDir, "..");
const sourceDir = resolve(extensionDir, "../../packages/core/src");
const vendorRoot = resolve(extensionDir, "vendor");
const vendorDir = resolve(vendorRoot, "core");
const lockDir = resolve(vendorRoot, ".sync-lock");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function wait(ms) {
  await new Promise((resolveWait) => {
    setTimeout(resolveWait, ms);
  });
}

async function acquireLock() {
  await mkdir(vendorRoot, { recursive: true });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await mkdir(lockDir);
      return;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        await wait(50);
        continue;
      }

      throw error;
    }
  }

  throw new Error("Timed out waiting for the Raycast core sync lock.");
}

await acquireLock();

let exitCode = 0;

try {
  if (await exists(sourceDir)) {
    await rm(vendorDir, { force: true, recursive: true });
    await cp(sourceDir, vendorDir, { recursive: true });
    console.log("Synced shared core into vendor/core.");
  } else if (await exists(vendorDir)) {
    console.log("Shared core source not found; using existing vendored snapshot.");
  } else {
    console.error(
      "Cannot sync shared core: packages/core/src is missing and no vendored snapshot exists in apps/raycast/vendor/core.",
    );
    exitCode = 1;
  }
} finally {
  await rm(lockDir, { force: true, recursive: true });
}

process.exit(exitCode);
