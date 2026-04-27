#!/usr/bin/env tsx
/**
 * Database Migration Script
 *
 * Usage: pnpm migrate <migration-file> [--prod] [--dry-run]
 *
 * Examples:
 *   pnpm migrate 001_create_docs_table.sql            # Local
 *   pnpm migrate 001_create_docs_table.sql --prod     # PRODUCTION (requires confirmation)
 *   pnpm migrate 001_create_docs_table.sql --dry-run  # Preview without executing
 *
 * Reads env from .env.local (default) or .env.production (--prod).
 */

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

function parseArgs() {
  const args = process.argv.slice(2);
  const isProd = args.includes("--prod");
  const isDryRun = args.includes("--dry-run");
  const migrationFile = args.find((arg) => !arg.startsWith("--"));
  return { isProd, isDryRun, migrationFile };
}

async function confirmProduction(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "\nWARNING: about to run migrations on PRODUCTION.\nType 'yes' to confirm: ",
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "yes");
      },
    );
  });
}

async function runMigration() {
  const { isProd, isDryRun, migrationFile } = parseArgs();

  if (!migrationFile) {
    console.error("Error: migration filename is required.");
    console.error("Usage: pnpm migrate <migration-file> [--prod] [--dry-run]");
    listAvailableMigrations();
    process.exit(1);
  }

  const envFile = isProd ? ".env.production" : ".env.local";
  const envPath = path.join(process.cwd(), envFile);

  if (!fs.existsSync(envPath)) {
    console.error(`Error: env file not found: ${envFile}`);
    if (isProd) {
      console.error("Create .env.production with your production POSTGRES_URL.");
    } else {
      console.error("Copy .env.example to .env.local and fill in values.");
    }
    process.exit(1);
  }

  config({ path: envPath });

  const environment = isProd ? "PRODUCTION" : "local";
  console.log(`\nDatabase migration`);
  console.log(`  Environment: ${environment}`);
  console.log(`  Migration:   ${migrationFile}`);
  if (isDryRun) {
    console.log(`  Mode:        DRY RUN (no changes)`);
  }
  console.log();

  if (isProd && !isDryRun) {
    const confirmed = await confirmProduction();
    if (!confirmed) {
      console.log("\nMigration cancelled.\n");
      process.exit(0);
    }
    console.log();
  }

  if (!process.env.POSTGRES_URL) {
    console.error(`Error: POSTGRES_URL not found in ${envFile}`);
    process.exit(1);
  }

  if (isDryRun) {
    const url = new URL(process.env.POSTGRES_URL);
    console.log(`  Database:    ${url.host}\n`);
  }

  const migrationPath = path.join(process.cwd(), "migrations", migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: migration file not found: ${migrationPath}`);
    listAvailableMigrations();
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
  const statements = splitSqlStatements(migrationSQL);

  console.log(
    `Found ${statements.length} SQL statement${statements.length === 1 ? "" : "s"}${isDryRun ? " to preview" : " to execute"}\n`,
  );

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;

    if (isDryRun) {
      console.log(`[${i + 1}/${statements.length}] Would execute:`);
      console.log("─".repeat(60));
      console.log(statement.trim());
      console.log("─".repeat(60) + "\n");
    } else {
      const firstLine = statement.split("\n")[0]!.substring(0, 60);
      console.log(`[${i + 1}/${statements.length}] Executing: ${firstLine}...`);

      try {
        await sql.query(statement + ";");
        console.log(`  Done\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("already exists")) {
          console.log(`  Already exists (skipping)\n`);
        } else {
          throw error;
        }
      }
    }
  }

  if (isDryRun) {
    console.log("Dry run complete. No changes were made.\n");
  } else {
    console.log("Migration completed successfully.\n");
  }
  process.exit(0);
}

function listAvailableMigrations() {
  const dir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(dir)) {
    console.error("\nNo migrations/ directory found.");
    return;
  }
  console.error("\nAvailable migrations:");
  fs.readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .forEach((f) => console.error(`  - ${f}`));
}

/**
 * Split SQL into statements, respecting dollar-quoted strings ($$...$$).
 * Required for PL/pgSQL functions which contain semicolons inside their bodies.
 */
function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const nextChar = sqlText[i + 1];

    if (char === "$" && nextChar === "$") {
      inDollarQuote = !inDollarQuote;
      current += "$$";
      i++;
      continue;
    }

    if (char === ";" && !inDollarQuote) {
      pushStatement(statements, current);
      current = "";
    } else {
      current += char;
    }
  }

  pushStatement(statements, current);
  return statements;
}

function pushStatement(statements: string[], raw: string) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return;
  const withoutComments = trimmed
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
  if (withoutComments.length > 0) {
    statements.push(trimmed);
  }
}

runMigration().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
