import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pendingMigrations } from "./migration-plan.mjs";

async function main() {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
  
  const allFiles = readdirSync("migrations").filter(f => f.endsWith(".sql"));
  console.log("Total SQL files in migrations:", allFiles.length);
  
  const pending = pendingMigrations(allFiles.map(f => `/migrations/${f}`), []);
  console.log("Pending migrations count:", pending.length);
  
  for (const { name, path } of pending) {
    const filename = path.replace("/migrations/", "");
    process.stdout.write(`Migrating ${filename}... `);
    const sql = readFileSync(join("migrations", filename), "utf8");
    const t0 = Date.now();
    try {
      await pg.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
      console.log(`OK (${Date.now() - t0}ms)`);
    } catch (e) {
      console.log("FAILED:", e.message);
      process.exit(1);
    }
  }
  console.log("SUCCESS: All migrations applied cleanly to PGlite in memory!");

  console.log("Testing idempotence: re-running 0034_sports.sql...");
  await pg.exec(readFileSync("migrations/0034_sports.sql", "utf8"));
  console.log("Re-running 0034_sports.sql: OK");

  console.log("Testing custom slot preservation before re-running 0035_media_library.sql...");
  await pg.exec("update site_assets set src_path = '/media/custom-edited-by-manager.jpg' where slot = 'landing.hero.image'");

  console.log("Testing idempotence: re-running 0035_media_library.sql...");
  await pg.exec(readFileSync("migrations/0035_media_library.sql", "utf8"));
  const heroCheck = await pg.query("select src_path from site_assets where slot = 'landing.hero.image'");
  if (heroCheck.rows[0]?.src_path !== "/media/custom-edited-by-manager.jpg") {
    throw new Error(`0035 overwritten custom slot! Got ${heroCheck.rows[0]?.src_path}`);
  }
  console.log("Preserved custom slot successfully across re-run: OK");
  console.log("IDEMPOTENCE VERIFIED: 0034 and 0035 re-executed cleanly!");
}

main().catch(e => {
  console.error("Crash:", e);
  process.exit(1);
});
