import { defineConfig } from "vite";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Relative base so the built app works whether it's served from a domain
// root or a GitHub Pages project subpath (https://user.github.io/repo/) —
// see Demo 9/CHANGES.md for why an absolute base like "/" would break the
// Pages deployment.
export default defineConfig({
  base: "./",
  // Machine-specific workaround, portable by construction: on a folder
  // synced by a cloud-sync client (this repo's dev machine uses Synology
  // Drive), Vite's dependency-optimizer cache under node_modules/.vite can
  // fail to be deleted/recreated (EPERM on rmdir) because the sync client's
  // filesystem filter driver holds/intercepts handles to files it's
  // actively watching. Pointing the cache at the OS temp directory instead
  // sidesteps that entirely. This is a no-op behavior change on any machine
  // without that problem — os.tmpdir() resolves per-machine, so nothing
  // here is hardcoded to this developer's path.
  cacheDir: join(tmpdir(), "vite-cache-project-remotion")
});
