/**
 * Types for the full occurrence detail view.
 * Mirrors Firestore document structure at occurrences/{id} + subcollections.
 */

// ─── Main occurrence ────────────────────────────────────────────────────────

export type OccurrenceStatus =
  | "open"
  | "in_progress"
  | "pending_signatures"
  | "finalized"
  | "cancelled";

export type OccurrenceNature =
  | "patrol"
  | "apprehension"
  | "search"
  | "escort"
  | "support"
  | "training_field"
  | "other";

export type OccurrenceDetail = {
  id: string;
  code: string;
  title: string;
  nature: OccurrenceNature;
  nature_label: string;
  status: OccurrenceStatus;
  description: string;

  // Handler / K9
  handler_id: string;
  handler_name: string;
  dog_id: string | null;
  dog_name: string | null;

  // Vehicle
  vehicle_prefix: string | null;
  vehicle_id: string | null;

  // Timing
  start_time: Date | null;
  end_time: Date | null;
  finalized_at: Date | null;

  // Team
  team_handler_ids: string[];
  team_names: string[];
  team_emails: string[];
  participation_status: string | null;
  accepted_handler_ids: string[];
  pending_handler_ids: string[];

  // Signatures state
  signatures_required: number;
  signatures_collected: number;

  // Location
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;

  // Integrity (finalized only)
  integrity_hash: string | null;
  verification_code: string | null;
  verification_url: string | null;
  sealed_at: Date | null;

  // Apprehension
  apprehension_items: ApprehensionItem[];

  // Amendments count (for UI hint)
  amendments_count: number;
};

export type ApprehensionItem = {
  type: string;
  description: string;
  quantity: number;
  unit: string;
  weight_grams: number | null;
};

// ─── Subcollection: events ──────────────────────────────────────────────────

export type OccurrenceEventType =
  | "created"
  | "started"
  | "location_update"
  | "note"
  | "photo"
  | "apprehension_registered"
  | "team_joined"
  | "team_left"
  | "signature_collected"
  | "amendment_added"
  | "finalized"
  | "cancelled";

export type OccurrenceEvent = {
  id: string;
  type: OccurrenceEventType;
  label: string;
  description: string | null;
  actor_name: string;
  actor_id: string;
  created_at: Date | null;
  metadata: Record<string, unknown>;
};

// ─── Subcollection: signatures ──────────────────────────────────────────────

export type OccurrenceSignature = {
  id: string;
  handler_id: string;
  handler_name: string;
  role: string;
  signed_at: Date | null;
  method: "biometric" | "pin" | "manual";
  device_info: string | null;
};

// ─── Subcollection: participations ──────────────────────────────────────────

export type OccurrenceParticipation = {
  id: string;
  handler_id: string;
  handler_name: string;
  status: "accepted" | "pending" | "declined";
  joined_at: Date | null;
  left_at: Date | null;
  dog_id: string | null;
  dog_name: string | null;
};

// ─── Subcollection: amendments ──────────────────────────────────────────────

export type OccurrenceAmendment = {
  id: string;
  author_id: string;
  author_name: string;
  reason: string;
  description: string;
  created_at: Date | null;
  fields_changed: string[];
};
