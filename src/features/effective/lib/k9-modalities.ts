export const canonicalK9Modalities = [
  { label: "Busca & Captura", value: "busca_captura" },
  { label: "Deteccao", value: "deteccao" },
  { label: "Guarda & Protecao", value: "guarda_protecao" },
] as const;

function modalitySlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("&", " e ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function canonicalModality(value: string) {
  const slug = modalitySlug(value);

  if (
    [
      "deteccao",
      "detection",
      "deteccao_de_armas",
      "deteccao_armas",
      "deteccao_de_armas_e_polvora",
      "deteccao_de_entorpecentes",
      "deteccao_entorpecentes",
      "deteccao_de_drogas",
      "deteccao_drogas",
    ].includes(slug)
  ) {
    return "deteccao";
  }

  if (["busca_captura", "busca_e_captura"].includes(slug)) {
    return "busca_captura";
  }

  if (["guarda_protecao", "guarda_e_protecao"].includes(slug)) {
    return "guarda_protecao";
  }

  return slug;
}

export function canonicalModalityLabel(value: string) {
  const canonical = canonicalModality(value);
  return (
    canonicalK9Modalities.find((item) => item.value === canonical)?.label ??
    canonical
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export function canonicalizeModalities(values: string[]) {
  return Array.from(
    new Set(values.map(canonicalModality).filter(Boolean)),
  );
}

export function isCanonicalK9Modality(value: string) {
  const canonical = canonicalModality(value);
  return canonicalK9Modalities.some((item) => item.value === canonical);
}
