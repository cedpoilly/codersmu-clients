import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionDir = resolve(scriptDir, "..");
const vendorRoot = resolve(extensionDir, "vendor");
const sharedPackages = [
  {
    sourceDir: resolve(extensionDir, "../../packages/contracts/src"),
    vendorDir: resolve(vendorRoot, "contracts"),
    label: "contracts",
  },
  {
    sourceDir: resolve(extensionDir, "../../packages/core/src"),
    vendorDir: resolve(vendorRoot, "core"),
    label: "core",
  },
];
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
  const missingPackages = [];
  let syncedPackages = 0;

  for (const sharedPackage of sharedPackages) {
    if (await exists(sharedPackage.sourceDir)) {
      await rm(sharedPackage.vendorDir, { force: true, recursive: true });
      await cp(sharedPackage.sourceDir, sharedPackage.vendorDir, { recursive: true });
      syncedPackages += 1;
      continue;
    }

    if (!await exists(sharedPackage.vendorDir)) {
      missingPackages.push(sharedPackage.label);
    }
  }

  if (missingPackages.length > 0) {
    console.error(
      `Cannot sync shared packages: missing source and vendored snapshot for ${missingPackages.join(", ")}.`,
    );
    exitCode = 1;
  } else if (syncedPackages > 0) {
    console.log("Synced shared contracts and core into vendor/.");
  } else {
    console.log("Shared package sources not found; using existing vendored snapshots.");
  }
} finally {
  await rm(lockDir, { force: true, recursive: true });
}

process.exit(exitCode);
