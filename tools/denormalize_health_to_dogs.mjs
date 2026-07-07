import process from "node:process";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

const projectId = getArg("--project") ?? "canil-gcm";
const serviceAccountPath = getArg("--service-account");
const dryRun = hasFlag("--dry-run");

const credential = serviceAccountPath
  ? cert(JSON.parse(await readFile(resolve(serviceAccountPath), "utf8")))
  : applicationDefault();

initializeApp({ credential, projectId });

const db = getFirestore();

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[denormalize-health] project=${projectId} dryRun=${dryRun}`);

  const dogsSnap = await db.collection("dogs").where("active", "==", true).get();
  console.log(`[denormalize-health] ${dogsSnap.size} active dogs found`);

  let updated = 0;
  let skipped = 0;

  for (const dogDoc of dogsSnap.docs) {
    const dogId = dogDoc.id;
    const dogRef = db.collection("dogs").doc(dogId);

    // Fetch latest weight record
    const weightSnap = await db
      .collection("dogs")
      .doc(dogId)
      .collection("weight_records")
      .orderBy("measured_at", "desc")
      .limit(1)
      .get();

    // Fetch latest vaccination event
    const vaccineSnap = await db
      .collection("dogs")
      .doc(dogId)
      .collection("health_events")
      .where("type", "in", ["vaccination", "vacina", "vaccine"])
      .orderBy("date", "desc")
      .limit(1)
      .get();

    // Fetch latest exam event
    const examSnap = await db
      .collection("dogs")
      .doc(dogId)
      .collection("health_events")
      .where("type", "in", ["exam", "exame", "examination", "checkup"])
      .orderBy("date", "desc")
      .limit(1)
      .get();

    const update = {};

    if (!weightSnap.empty) {
      const w = weightSnap.docs[0].data();
      const weightKg =
        typeof w.weight_kg === "number"
          ? w.weight_kg
          : typeof w.weightKg === "number"
            ? w.weightKg
            : typeof w.weight === "number"
              ? w.weight
              : typeof w.peso === "number"
                ? w.peso
                : null;
      const measuredAt = w.measured_at ?? w.measuredAt ?? w.created_at ?? null;
      if (weightKg != null) update._last_weight_kg = weightKg;
      if (measuredAt != null) update._last_weight_at = measuredAt;
    }

    if (!vaccineSnap.empty) {
      const v = vaccineSnap.docs[0].data();
      const vaccineDate = v.date ?? v.event_date ?? v.eventDate ?? v.created_at ?? null;
      const vaccineDueDate = v.nextDueDate ?? v.next_due_date ?? v.due_date ?? null;
      if (vaccineDate != null) update._last_vaccine_at = vaccineDate;
      if (vaccineDueDate != null) {
        update._last_vaccine_due_at = vaccineDueDate;
      } else {
        update._last_vaccine_due_at = FieldValue.delete();
      }
    }

    if (!examSnap.empty) {
      const e = examSnap.docs[0].data();
      const examDate = e.date ?? e.event_date ?? e.eventDate ?? e.created_at ?? null;
      if (examDate != null) update._last_exam_at = examDate;
    }

    if (Object.keys(update).length === 0) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] ${dogId}: would write`, JSON.stringify(update, null, 2));
    } else {
      await dogRef.update(update);
    }
    updated++;
  }

  console.log(`[denormalize-health] done: ${updated} updated, ${skipped} skipped (no health data)`);
}

main().catch((err) => {
  console.error("[denormalize-health] FATAL:", err);
  process.exit(1);
});
