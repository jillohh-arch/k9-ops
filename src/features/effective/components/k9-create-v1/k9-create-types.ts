/**
 * Types for K9 Create V1 form.
 *
 * This is a narrow contract: only fields that belong to initial K9 creation.
 * Health (weight, idealWeight), Binomials (conductorRa), and Training (specialties)
 * are explicitly excluded.
 */

export type K9CreateFormValues = {
  name: string;
  registrationNumber: string;
  breed: string;
  sex: "M" | "F" | ""; // UI will enforce "M" | "F"
  birthDate: string; // ISO date: YYYY-MM-DD
  color: string; // Optional pelage/coloring
  size: string; // Optional porte
  microchip: string; // Optional
  notes: string; // Optional observações, max 800 chars
  profileImageUrl: string; // URL if already uploaded, empty if not
};
