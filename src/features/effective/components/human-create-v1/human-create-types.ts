/**
 * Types for Human Create V1 form.
 *
 * Narrow contract: only fields that belong to initial personnel creation via
 * the homologated `adminCreateHuman` callable. Access provisioning (perfil de
 * acesso, accessLevel), Firebase Auth, Training, Binomial, Shift and Photo are
 * explicitly EXCLUDED — those are separate authorities/flows, never part of
 * this create.
 *
 * Every field is a UI string. Required: ra, fullName, callsign. All other
 * fields are optional personnel data; a blank optional is OMITTED on the wire
 * (never sent as null / empty placeholder), matching the backend contract.
 */
export type HumanCreateFormValues = {
  // Identificação (ra/fullName/callsign obrigatórios)
  ra: string;
  fullName: string;
  callsign: string;
  // Dados funcionais (opcionais)
  rank: string;
  cargo: string;
  unit: string;
  team: string;
  admissionDate: string; // ISO date: YYYY-MM-DD
  // Contato / pessoal (opcionais)
  cpf: string;
  birthDate: string; // ISO date: YYYY-MM-DD
  phone: string;
  institutionalEmail: string;
  // Observações (opcional)
  notes: string;
};

export const emptyHumanCreateValues: HumanCreateFormValues = {
  ra: "",
  fullName: "",
  callsign: "",
  rank: "",
  cargo: "",
  unit: "",
  team: "",
  admissionDate: "",
  cpf: "",
  birthDate: "",
  phone: "",
  institutionalEmail: "",
  notes: "",
};
