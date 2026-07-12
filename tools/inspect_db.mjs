#!/usr/bin/env node
/**
 * inspect_db.mjs — Read-only Firestore inspector
 *
 * Usage:
 *   node tools/inspect_db.mjs --collection trainings --limit 3
 *   node tools/inspect_db.mjs --collection training_sessions --limit 5
 *
 * Environment:
 *   GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON (required)
 *   FIRESTORE_PROJECT_ID — project ID (default: reads from service account)
 *
 * This script performs READ-ONLY operations. No data is modified.
 */

import { readFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);

function usage() {
  console.log(`Usage: node tools/inspect_db.mjs --collection <name> [--limit <n>]`);
  console.log(`\nRequired env: GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)`);
  process.exit(1);
}

if (args.includes("--help") || args.includes("-h")) usage();

const collectionIdx = args.indexOf("--collection");
if (collectionIdx === -1 || !args[collectionIdx + 1]) {
  console.error("Error: --collection <name> is required.");
  usage();
}
const collectionName = args[collectionIdx + 1];

const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) || 5 : 5;

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

console.log(`\n=== COLLECTION: ${collectionName} (limit ${limit}) ===\n`);
const snapshot = await db.collection(collectionName).limit(limit).get();

if (snapshot.empty) {
  console.log("(empty collection)");
} else {
  snapshot.forEach((doc) => {
    console.log(`--- Doc ID: ${doc.id} ---`);
    console.log(JSON.stringify(doc.data(), null, 2));
    console.log();
  });
  console.log(`Total shown: ${snapshot.size}`);
}
