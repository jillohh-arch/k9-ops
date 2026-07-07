"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import {
  canônicalModality,
  canônicalModalityLabel,
} from "@/features/effective/lib/k9-modalities";
import { useEntities } from "@/features/effective/providers/entities-provider";
import { db } from "@/lib/firebase/client";

type RawRecord = Record<string, unknown> & { _id: string };

export type K9Specialty = {
  id: string;
  status: "not_started" | "in_formation" | "operational" | string;
  type: string;
};

export type EffectiveDog = {
  conductorRa: string | null;
  dateOfBirth: Date | null;
  id: string;
  name: string;
  profileImageUrl: string | null;
  registrationNumber: string | null;
  breed: string | null;
  sex: string | null;
  specialties: K9Specialty[];
  status: string;
};

export type EffectiveUser = {
  accessLevel: string;
  active: boolean;
  callsign: string;
  fullName: string | null;
  isK9Instructor: boolean;
  photoUrl: string | null;
  ra: string;
  unit: string | null;
};

export type EffectiveShift = {
  dogId: string;
  handlerRa: string;
  id: string;
  startedAt: Date | null;
  status: string;
  vehicleLabel: string | null;
  vehicleId: string | null;
};

export type EffectiveVehicle = {
  active: boolean;
  base: string | null;
  brand: string | null;
  crewSize: number;
  fuel: string | null;
  id: string;
  label: string;
  maintenanceStatus: string | null;
  mileageKm: number | null;
  model: string | null;
  name: string;
  nextReviewAt: Date | null;
  nextReviewKm: number | null;
  photoUrl: string | null;
  plate: string | null;
  prefix: string;
  status: string;
  unit: string | null;
  year: string | null;
};

export type EffectiveBinomial = {
  active: boolean;
  dogId: string;
  dogName: string | null;
  handlerName: string | null;
  handlerRa: string;
  id: string;
  primary: boolean;
  primarySpecialty: string | null;
  readinessScore: number | null;
  startAt: Date | null;
  status: string;
  team: string | null;
  type: string | null;
  unit: string | null;
};

type CollectionState = {
  error: string | null;
  loading: boolean;
  records: RawRecord[];
};

const initialState: CollectionState = {
  error: null,
  loading: true,
  records: [],
};

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const parsed = normalized(value);
  if (["true", "1", "sim", "ativo", "active"].includes(parsed)) return true;
  if (["false", "0", "nao", "inativo", "inactive"].includes(parsed)) {
    return false;
  }
  return fallback;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

function isDeleted(record: Record<string, unknown>) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    booleanValue(record.deleted, false)
  );
}

function mapDog(record: RawRecord, specialties: K9Specialty[]): EffectiveDog {
  return {
    conductorRa: text(
      record.conductorRa,
      record.conductor_ra,
      record.handlerId,
      record.handler_id,
    ),
    dateOfBirth: dateValue(record.dateOfBirth ?? record.date_of_birth),
    id: record._id,
    name: text(record.name, record.nome) ?? "K9 sem nome",
    profileImageUrl: text(
      record.profileImageUrl,
      record.profile_image_url,
      record.photoUrl,
      record.image_url,
    ),
    registrationNumber: text(
      record.matricula,
      record.registrationNumber,
      record.registration_number,
      record.rga,
    ),
    breed: text(record.breed, record.raça),
    sex: text(record.sex, record.sexo),
    specialties,
    status: text(record.status, record.situação) ?? "Ativo",
  };
}

function mapUser(record: RawRecord): EffectiveUser {
  const ra = text(record.ra, record.id, record._id) ?? record._id;
  return {
    accessLevel:
      text(record.accessLevel, record.access_level, record.role) ?? "Operador",
    active: booleanValue(record.active, true) && !isDeleted(record),
    callsign:
      text(
        record.callsign,
        record.callSign,
        record.nome_guerra,
        record.nome,
        record.name,
      ) ?? ra,
    fullName: text(record.name, record.nome_completo, record.fullName),
    isK9Instructor:
      record.is_k9_instructor === true ||
      record.training_instructor === true ||
      normalized(record.training_role) === "instrutor_k9" ||
      normalized(record.role) === "instrutor_k9",
    photoUrl: text(record.photoUrl, record.image_url, record.photo_url),
    ra,
    unit: text(record.unit, record.unidade),
  };
}

function mapShift(record: RawRecord): EffectiveShift {
  return {
    dogId:
      text(
        record.service_dog_id,
        record.dogId,
        record.currentDogId,
        record.dog_id,
      ) ?? "",
    handlerRa:
      text(record.handlerId, record.handler_id, record.ra, record._id) ?? "",
    id: record._id,
    startedAt: dateValue(record.startedAt ?? record.started_at),
    status: text(record.status) ?? "active",
    vehicleId: text(record.vehicle_id, record.vehicleId),
    vehicleLabel: text(
      record.vehicle_label,
      record.vehicleLabel,
      record.vehicle_prefix,
    ),
  };
}

function mapVehicle(record: RawRecord): EffectiveVehicle {
  const prefix = text(record.prefix, record.vehicle_prefix, record._id) ?? record._id;
  const name = text(record.name, record.nome) ?? "Viatura";
  const label = text(record.label, record.vehicle_label) ?? [name, prefix].filter(Boolean).join(" ");
  return {
    active: booleanValue(record.active, true) && !isDeleted(record),
    base: text(record.base, record.lotação),
    brand: text(record.brand, record.marca),
    crewSize: numberValue(record.crew_size ?? record.crewSize) ?? 1,
    fuel: text(record.fuel, record.combustivel),
    id: record._id,
    label: label || record._id,
    maintenanceStatus: text(record.maintenance_status, record.maintenanceStatus),
    mileageKm: numberValue(record.mileage_km ?? record.mileageKm),
    model: text(record.model, record.vehicle_model, record.modelo),
    name,
    nextReviewAt: dateValue(record.next_review_at ?? record.nextReviewAt),
    nextReviewKm: numberValue(record.next_review_km ?? record.nextReviewKm),
    photoUrl: text(record.photoUrl, record.photo_url, record.image_url),
    plate: text(record.plate, record.placa),
    prefix,
    status: text(record.status, record.situação) ?? (booleanValue(record.active, true) ? "Ativa" : "Inativa"),
    unit: text(record.unit, record.unidade, record.vehicle_unit),
    year: text(record.year, record.ano),
  };
}

function mapBinomial(record: RawRecord): EffectiveBinomial {
  const status = text(record.status) ?? "Ativo";
  return {
    active: booleanValue(record.active, true) && !isDeleted(record),
    dogId: text(record.dog_id, record.dogId) ?? "",
    dogName: text(record.dog_name, record.dogName),
    handlerName: text(record.handler_name, record.handlerName),
    handlerRa: text(record.handler_ra, record.handlerRa) ?? "",
    id: record._id,
    primary: booleanValue(record.primary, true),
    primarySpecialty: text(record.primary_specialty, record.primarySpecialty),
    readinessScore: numberValue(record.readiness_score ?? record.readinessScore),
    startAt: dateValue(record.start_at ?? record.startAt),
    status,
    team: text(record.team, record.equipe),
    type: text(record.type, record.tipo),
    unit: text(record.unit, record.unidade),
  };
}

function subscribeCollection(
  path: string,
  setter: React.Dispatch<React.SetStateAction<CollectionState>>,
  constraints?: QueryConstraint[],
) {
  const ref: Query = constraints
    ? query(collection(db, path), ...constraints)
    : collection(db, path);
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      setter({
        error: null,
        loading: false,
        records: snapshot.docs.map((item) => ({
          ...item.data(),
          _id: item.id,
        })),
      });
    },
    (error) => {
      setter({ error: error.message, loading: false, records: [] });
    },
  );
}

export function useEffectiveData() {
  const { dogs: entityDogs, dogsLoading, users: entityUsers, usersLoading, vehicles: entityVehicles, vehiclesLoading } = useEntities();
  const [binomialsState, setBinomialsState] =
    useState<CollectionState>(initialState);
  const [dogsState, setDogsState] = useState<CollectionState>(initialState);
  const [usersState, setUsersState] = useState<CollectionState>(initialState);
  const [vehiclesState, setVehiclesState] =
    useState<CollectionState>(initialState);
  const [shiftsState, setShiftsState] = useState<CollectionState>(initialState);
  const [specialtiesByDog, setSpecialtiesByDog] = useState<
    Record<string, K9Specialty[]>
  >({});
  const [specialtiesLoading, setSpecialtiesLoading] = useState(true);
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null);

  useEffect(() => {
    setDogsState({ error: null, loading: dogsLoading, records: entityDogs });
  }, [entityDogs, dogsLoading]);

  useEffect(() => {
    setUsersState({ error: null, loading: usersLoading, records: entityUsers });
  }, [entityUsers, usersLoading]);

  useEffect(() => {
    setVehiclesState({ error: null, loading: vehiclesLoading, records: entityVehicles });
  }, [entityVehicles, vehiclesLoading]);

  useEffect(() => {
    const unsubscribes = [
      subscribeCollection("binomials", setBinomialsState, [
        where("active", "==", true),
      ]),
      subscribeCollection("active_shifts", setShiftsState),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (dogsState.loading) return;

    const dogIds = dogsState.records
      .filter((record) => !isDeleted(record))
      .map((record) => record._id);

    if (dogIds.length === 0) {
      const timer = window.setTimeout(() => {
        setSpecialtiesByDog({});
        setSpecialtiesLoading(false);
        setSpecialtiesError(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const current = new Map<string, K9Specialty[]>();
    const pending = new Set(dogIds);
    const errors = new Map<string, string>();

    const unsubscribes = dogIds.map((dogId) =>
      onSnapshot(
        collection(db, "dogs", dogId, "specialties"),
        (snapshot) => {
          const byType = new Map<string, K9Specialty>();
          for (const item of snapshot.docs) {
            const data = item.data();
            if (isDeleted(data)) continue;
            const specialty = {
              id: item.id,
              status:
                text(data.status, data.state) ?? ("not_started" as const),
              type: canônicalModality(
                text(data.type, data.modality, item.id) ?? item.id,
              ),
            };
            if (specialty.status === "not_started") continue;
            const existing = byType.get(specialty.type);
            const priority = (status: string) =>
              status === "operational"
                ? 3
                : status === "in_formation"
                  ? 2
                  : 1;
            if (
              !existing ||
              priority(specialty.status) > priority(existing.status)
            ) {
              byType.set(specialty.type, specialty);
            }
          }
          current.set(dogId, Array.from(byType.values()));
          pending.delete(dogId);
          errors.delete(dogId);
          setSpecialtiesByDog(Object.fromEntries(current));
          setSpecialtiesLoading(pending.size > 0);
          setSpecialtiesError(
            errors.size ? Array.from(errors.values()).join(" | ") : null,
          );
        },
        (error) => {
          pending.delete(dogId);
          errors.set(dogId, error.message);
          setSpecialtiesLoading(pending.size > 0);
          setSpecialtiesError(Array.from(errors.values()).join(" | "));
        },
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [dogsState.loading, dogsState.records]);

  const dogs = useMemo(
    () =>
      dogsState.records
        .filter((record) => !isDeleted(record))
        .map((record) => mapDog(record, specialtiesByDog[record._id] ?? []))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [dogsState.records, specialtiesByDog],
  );
  const users = useMemo(
    () =>
      usersState.records
        .filter((record) => !isDeleted(record))
        .map(mapUser)
        .sort((a, b) => a.callsign.localeCompare(b.callsign, "pt-BR")),
    [usersState.records],
  );
  const shifts = useMemo(
    () =>
      shiftsState.records
        .filter(
          (record) =>
            !isDeleted(record) && normalized(record.status) === "active",
        )
        .map(mapShift)
        .filter((shift) => shift.dogId && shift.handlerRa),
    [shiftsState.records],
  );
  const vehicles = useMemo(
    () =>
      vehiclesState.records
        .filter((record) => !isDeleted(record))
        .map(mapVehicle)
        .sort((a, b) => a.prefix.localeCompare(b.prefix, "pt-BR")),
    [vehiclesState.records],
  );
  const binomials = useMemo(
    () =>
      binomialsState.records
        .filter((record) => !isDeleted(record))
        .map(mapBinomial)
        .filter((binomial) => binomial.dogId && binomial.handlerRa)
        .sort((a, b) =>
          (a.dogName ?? a.id).localeCompare(b.dogName ?? b.id, "pt-BR"),
        ),
    [binomialsState.records],
  );

  return {
    binomials,
    dogs,
    error:
      binomialsState.error ??
      dogsState.error ??
      usersState.error ??
      vehiclesState.error ??
      shiftsState.error ??
      specialtiesError,
    loading:
      binomialsState.loading ||
      dogsState.loading ||
      usersState.loading ||
      vehiclesState.loading ||
      shiftsState.loading ||
      specialtiesLoading,
    shifts,
    users,
    vehicles,
  };
}

export function specialtyLabel(type: string) {
  return canônicalModalityLabel(type);
}

export function ageInYears(date: Date | null) {
  if (!date) return null;
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const beforeBirthday =
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (beforeBirthday) years -= 1;
  return Math.max(0, years);
}

export function normalizedStatus(value: string) {
  return normalized(value);
}
