import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase/client";

export const callSetK9InstructorRole = httpsCallable<
  { ra: string; enabled: boolean },
  Record<string, unknown>
>(functions, "setK9InstructorRole");

export const callInviteVehicleCrewMember = httpsCallable<
  { crewId: string; handlerId: string },
  Record<string, unknown>
>(functions, "inviteVehicleCrewMember");

export const callRespondVehicleCrewInvitation = httpsCallable<
  { crewId: string; accepted: boolean; reason?: string },
  Record<string, unknown>
>(functions, "respondVehicleCrewInvitation");
