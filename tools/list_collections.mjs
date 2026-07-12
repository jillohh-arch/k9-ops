#!/usr/bin/env node
/**
 * list_collections.mjs — List all root-level Firestore collections
 *
 * Usage:
 *   node tools/list_collections.mjs
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
const collections = await db.listCollections();

console.log("Root collections:");
for (const col of collections) {
  console.log(`  - ${col.id}`);
}
console.log(`\nTotal: ${collections.length}`);
