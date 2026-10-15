import { afterAll } from "vite-plus/test";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalDirectory = process.cwd();
if (process.env.CI !== "true" && existsSync(join(originalDirectory, ".env"))) {
  process.loadEnvFile(join(originalDirectory, ".env"));
}
const directory = mkdtempSync(join(tmpdir(), "journalism-ai-tests-"));
symlinkSync(join(originalDirectory, "test"), join(directory, "test"));
process.chdir(directory);
afterAll(() => {
  process.chdir(originalDirectory);
  rmSync(directory, { recursive: true, force: true });
});
