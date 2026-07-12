#!/usr/bin/env node
/**
 * seed_reports.mjs — Seed report_schedules and report_exports collections
 *
 * Usage:
 *   node tools/seed_reports.mjs --dry-run        (preview without writing)
 *   node tools/seed_reports.mjs --execute        (actually write to Firestore)
 *
 * Environment:
 *   GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON (required)
 *   FIRESTORE_PROJECT_ID — project ID (default: reads from service account)
 *
 * IMPORTANT: This script WRITES data. It requires --execute to perform mutations.
 * Without --execute or with --dry-run, it only shows what would be written.
 * It will NOT overwrite existing documents — skips collections that already have data.
 */

import { readFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || !args.includes("--execute");

if (!args.includes("--dry-run") && !args.includes("--execute")) {
  console.log("No mode specified. Defaulting to --dry-run (safe preview).");
  console.log("Pass --execute to actually write data.\n");
}

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node tools/seed_reports.mjs [--dry-run | --execute]");
  console.log("\n  --dry-run   Preview what would be written (default)");
  console.log("  --execute   Actually write seed data to Firestore");
  process.exit(0);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Error: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.");
  console.error("Set it to the path of your Firebase service account JSON file.");
  process.exit(1);
}

const credential = cert(JSON.parse(await readFile(credPath, "utf8")));
const projectId = process.env.FIRESTORE_PROJECT_ID || undefined;

initializeApp({ credential, ...(projectId && { projectId }) });

const db = getFirestore();

const initialSchedules = [
  {
    label: "Relatório Semanal de Saúde",
    detail: "Toda segunda-feira as 08:00",
    status: "Ativo",
    tone: "red",
    date: new Date(),
  },
  {
    label: "Relatório Mensal de Estoque",
    detail: "Todo dia 5 de cada mes",
    status: "Ativo",
    tone: "emerald",
    date: new Date(),
  },
  {
    label: "Relatório de Treinos",
    detail: "A cada 15 dias",
    status: "Ativo",
    tone: "violet",
    date: new Date(),
  },
  {
    label: "Resumo Mensal de Ocorrências",
    detail: "Todo dia 1 do mes",
    status: "Ativo",
    tone: "cyan",
    date: new Date(),
  },
];

const oneDayAgo = new Date(Date.now() - 86400000);
const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
const threeDaysAgo = new Date(Date.now() - 3 * 86400000);

const initialExports = [
  {
    label: "Relatório de Ocorrências",
    detail: "Resumo operacional do período",
    status: "PDF",
    tone: "cyan",
    meta: "Ragonha",
    date: oneDayAgo,
    reportId: "occurrences",
  },
  {
    label: "Inventário de Estoque",
    detail: "Inventário e movimentações",
    status: "XLSX",
    tone: "emerald",
    meta: "Sistema",
    date: twoDaysAgo,
    reportId: "inventory",
  },
  {
    label: "Relatório de Treinos",
    detail: "Sessões e evolução",
    status: "PDF",
    tone: "violet",
    meta: "Instrutor K9",
    date: threeDaysAgo,
    reportId: "training",
  },
];

async function seed() {
  console.log(`Mode: ${dryRun ? "DRY-RUN (no writes)" : "EXECUTE (writing to Firestore)"}\n`);

  // Seed report_schedules
  console.log("── report_schedules ──");
  const schedulesSnapshot = await db.collection("report_schedules").get();
  if (!schedulesSnapshot.empty) {
    console.log(`  Already has ${schedulesSnapshot.size} documents. Skipping.`);
  } else if (dryRun) {
    console.log(`  Would create ${initialSchedules.length} documents:`);
    initialSchedules.forEach((s) => console.log(`    - ${s.label}`));
  } else {
    const col = db.collection("report_schedules");
    for (const schedule of initialSchedules) {
      await col.add(schedule);
    }
    console.log(`  Created ${initialSchedules.length} documents.`);
  }

  // Seed report_exports
  console.log("\n── report_exports ──");
  const exportsSnapshot = await db.collection("report_exports").get();
  if (!exportsSnapshot.empty) {
    console.log(`  Already has ${exportsSnapshot.size} documents. Skipping.`);
  } else if (dryRun) {
    console.log(`  Would create ${initialExports.length} documents:`);
    initialExports.forEach((e) => console.log(`    - ${e.label} (${e.status})`));
  } else {
    const col = db.collection("report_exports");
    for (const exp of initialExports) {
      await col.add(exp);
    }
    console.log(`  Created ${initialExports.length} documents.`);
  }

  console.log("\nDone.");
}

seed().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
