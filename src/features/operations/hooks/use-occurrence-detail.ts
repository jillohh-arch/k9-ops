"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";

import type {
  ApprehensionItem,
  OccurrenceAmendment,
  OccurrenceDetail,
  OccurrenceEvent,
  OccurrenceNature,
  OccurrenceParticipation,
  OccurrenceSignature,
  OccurrenceStatus,
} from "../types/occurrence-detail";

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

// ─── Mappers ────────────────────────────────────────────────────────────────

function mapOccurrence(id: string, data: Record<string, unknown>): OccurrenceDetail {
  const items = Array.isArray(data.apprehension_items)
    ? (data.apprehension_items as Record<string, unknown>[]).map(
        (item): ApprehensionItem => ({
          type: str(item.type),
          description: str(item.description),
          quantity: num(item.quantity),
          unit: str(item.unit),
          weight_grams: numOrNull(item.weight_grams),
        }),
      )
    : [];

  return {
    id,
    code: str(data.code || data.occurrence_code),
    title: str(data.title),
    nature: (str(data.nature) || "other") as OccurrenceNature,
    nature_label: str(data.nature_label || data.nature_name || data.nature),
    status: (str(data.status) || "open") as OccurrenceStatus,
    description: str(data.description),

    handler_id: str(data.handler_id),
    handler_name: str(data.handler_name),
    dog_id: strOrNull(data.dog_id),
    dog_name: strOrNull(data.dog_name),

    vehicle_prefix: strOrNull(data.vehicle_prefix),
    vehicle_id: strOrNull(data.vehicle_id),

    start_time: toDate(data.start_time),
    end_time: toDate(data.end_time),
    finalized_at: toDate(data.finalized_at),

    team_handler_ids: strArray(data.team_handler_ids),
    team_names: strArray(data.team_names),
    team_emails: strArray(data.team_emails),
    participation_status: strOrNull(data.participation_status),
    accepted_handler_ids: strArray(data.accepted_handler_ids),
    pending_handler_ids: strArray(data.pending_handler_ids),

    signatures_required: num(data.signatures_required),
    signatures_collected: num(data.signatures_collected),

    location_label: strOrNull(data.location_label || data.location),
    latitude: numOrNull(data.latitude),
    longitude: numOrNull(data.longitude),

    integrity_hash: strOrNull(data.integrity_hash),
    verification_code: strOrNull(data.verification_code),
    verification_url: strOrNull(data.verification_url),
    sealed_at: toDate(data.sealed_at),

    apprehension_items: items,
    amendments_count: num(data.amendments_count),
  };
}

function mapEvent(id: string, data: Record<string, unknown>): OccurrenceEvent {
  return {
    id,
    type: (str(data.type) || "note") as OccurrenceEvent["type"],
    label: str(data.label || data.title || data.type),
    description: strOrNull(data.description),
    actor_name: str(data.actor_name || data.author_name || data.handler_name),
    actor_id: str(data.actor_id || data.author_id || data.handler_id),
    created_at: toDate(data.created_at ?? data.timestamp),
    metadata: (typeof data.metadata === "object" && data.metadata !== null ? data.metadata : {}) as Record<string, unknown>,
  };
}

function mapSignature(id: string, data: Record<string, unknown>): OccurrenceSignature {
  return {
    id,
    handler_id: str(data.handler_id),
    handler_name: str(data.handler_name),
    role: str(data.role || "participante"),
    signed_at: toDate(data.signed_at ?? data.created_at),
    method: (str(data.method) || "manual") as OccurrenceSignature["method"],
    device_info: strOrNull(data.device_info),
  };
}

function mapParticipation(id: string, data: Record<string, unknown>): OccurrenceParticipation {
  return {
    id,
    handler_id: str(data.handler_id),
    handler_name: str(data.handler_name),
    status: (str(data.status) || "pending") as OccurrenceParticipation["status"],
    joined_at: toDate(data.joined_at),
    left_at: toDate(data.left_at),
    dog_id: strOrNull(data.dog_id),
    dog_name: strOrNull(data.dog_name),
  };
}

function mapAmendment(id: string, data: Record<string, unknown>): OccurrenceAmendment {
  return {
    id,
    author_id: str(data.author_id),
    author_name: str(data.author_name),
    reason: str(data.reason),
    description: str(data.description),
    created_at: toDate(data.created_at),
    fields_changed: strArray(data.fields_changed),
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export type OccurrenceDetailData = {
  loading: boolean;
  error: string | null;
  occurrence: OccurrenceDetail | null;
  events: OccurrenceEvent[];
  signatures: OccurrenceSignature[];
  participations: OccurrenceParticipation[];
  amendments: OccurrenceAmendment[];
};

export function useOccurrenceDetail(occurrenceId: string): OccurrenceDetailData {
  const [occurrenceRaw, setOccurrenceRaw] = useState<{ data: Record<string, unknown> } | null>(null);
  const [events, setEvents] = useState<OccurrenceEvent[]>([]);
  const [signatures, setSignatures] = useState<OccurrenceSignature[]>([]);
  const [participations, setParticipations] = useState<OccurrenceParticipation[]>([]);
  const [amendments, setAmendments] = useState<OccurrenceAmendment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!occurrenceId) {
      // Defer state updates to avoid synchronous setState in effect body
      Promise.resolve().then(() => {
        setLoading(false);
        setError("ID da ocorrência não informado.");
      });
      return;
    }

    // Defer state reset to avoid synchronous setState in effect body
    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });

    const docRef = doc(db, "occurrences", occurrenceId);

    // Main document listener
    const unsubDoc = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          setError("Ocorrência não encontrada.");
          setOccurrenceRaw(null);
        } else {
          setOccurrenceRaw({ data: snap.data() as Record<string, unknown> });
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    // Subcollection: events
    const eventsQuery = query(
      collection(db, "occurrences", occurrenceId, "events"),
      orderBy("created_at", "asc"),
    );
    const unsubEvents = onSnapshot(eventsQuery, (snap) => {
      setEvents(snap.docs.map((d) => mapEvent(d.id, d.data() as Record<string, unknown>)));
    });

    // Subcollection: signatures
    const signaturesQuery = query(
      collection(db, "occurrences", occurrenceId, "signatures"),
      orderBy("signed_at", "asc"),
    );
    const unsubSignatures = onSnapshot(signaturesQuery, (snap) => {
      setSignatures(snap.docs.map((d) => mapSignature(d.id, d.data() as Record<string, unknown>)));
    });

    // Subcollection: participations
    const unsubParticipations = onSnapshot(
      collection(db, "occurrences", occurrenceId, "participations"),
      (snap) => {
        setParticipations(snap.docs.map((d) => mapParticipation(d.id, d.data() as Record<string, unknown>)));
      },
    );

    // Subcollection: amendments
    const amendmentsQuery = query(
      collection(db, "occurrences", occurrenceId, "amendments"),
      orderBy("created_at", "desc"),
    );
    const unsubAmendments = onSnapshot(amendmentsQuery, (snap) => {
      setAmendments(snap.docs.map((d) => mapAmendment(d.id, d.data() as Record<string, unknown>)));
    });

    return () => {
      unsubDoc();
      unsubEvents();
      unsubSignatures();
      unsubParticipations();
      unsubAmendments();
    };
  }, [occurrenceId]);

  const occurrence = useMemo(() => {
    if (!occurrenceRaw) return null;
    return mapOccurrence(occurrenceId, occurrenceRaw.data);
  }, [occurrenceId, occurrenceRaw]);

  return { loading, error, occurrence, events, signatures, participations, amendments };
}
