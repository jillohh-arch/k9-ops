"use client";

import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, CircleAlert, Dog, Loader } from "lucide-react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  loadK9ForEdit,
  saveK9IdentityV1,
  type K9FormValues,
} from "@/features/effective/data/k9-admin-service";
import { paths } from "@/lib/routes/paths";

import {
  K9EditError,
  projectK9EditIdentity,
  type K9EditIdentityValues,
} from "./k9-edit-adapter";
import {
  K9EditArchivedState,
  K9EditConflictNotice,
} from "./k9-edit-conflict";
import { K9EditOperationalContext } from "./k9-edit-context-card";
import {
  K9EditMainData,
  K9EditNotes,
  K9EditTraits,
  type K9EditFieldErrors,
} from "./k9-edit-identity-card";
import { K9EditPhoto } from "./k9-edit-photo";

const IDENTITY_KEYS = [
  "name",
  "registrationNumber",
  "breed",
  "sex",
  "birthDate",
  "color",
  "microchip",
  "size",
  "notes",
  "profileImageUrl",
] as const satisfies readonly (keyof K9EditIdentityValues)[];

/**
 * Local validation for Edit V1.
 *
 * `color` is deliberately NOT required here, unlike the legacy admin form: the
 * homologated backend treats it as optional and clearable, so requiring it in
 * the UI contradicted the contract and made clearing impossible.
 */
function validateIdentity(values: K9EditIdentityValues): K9EditFieldErrors {
  const errors: K9EditFieldErrors = {};
  if (!values.name.trim()) errors.name = "Informe o nome operacional.";
  if (!values.registrationNumber.trim()) {
    errors.registrationNumber = "Informe a matrícula/RGA.";
  }
  if (!values.breed.trim()) errors.breed = "Informe a raça.";
  if (values.sex !== "M" && values.sex !== "F") {
    errors.sex = "Informe o sexo.";
  }
  if (!values.birthDate) {
    errors.birthDate = "Informe a data de nascimento.";
  } else {
    const birth = new Date(`${values.birthDate}T12:00:00`);
    if (Number.isNaN(birth.getTime()) || birth > new Date()) {
      errors.birthDate = "Data de nascimento inválida.";
    }
  }
  return errors;
}

type LoadState = "loading" | "ready" | "missing" | "archived" | "error";

export function K9EditV1({ dogId }: { dogId: string }) {
  const router = useRouter();
  const { can } = useAccessControl();
  const canEditK9 = can("k9", "edit");

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [values, setValues] = useState<K9FormValues | null>(null);
  // Session baseline: set once per load, never mutated by user edits, so the
  // diff and the cross-domain guard always compare against the opened version.
  const [baselineValues, setBaselineValues] = useState<K9FormValues | null>(null);
  const [versionToken, setVersionToken] = useState<number | null>(null);
  const [errors, setErrors] = useState<K9EditFieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      // Set inside the async body: a synchronous setState in the effect would
      // trigger a cascading render.
      setLoadState("loading");
      try {
        const loaded = await loadK9ForEdit(dogId);
        if (!active) return;
        if (!loaded) {
          setLoadState("missing");
          return;
        }
        setValues(loaded.values);
        setBaselineValues(loaded.values);
        setVersionToken(loaded.versionToken);
        setPreviewUrl(loaded.values.profileImageUrl);
        setPhotoFile(null);
        setErrors({});
        setConflict(false);
        setLoadState(loaded.archived ? "archived" : "ready");
      } catch {
        if (active) setLoadState("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [dogId, reloadKey]);

  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const identity = useMemo(
    () => (values ? projectK9EditIdentity(values) : null),
    [values],
  );
  const baselineIdentity = useMemo(
    () => (baselineValues ? projectK9EditIdentity(baselineValues) : null),
    [baselineValues],
  );

  /** Dirty awareness covers only the 10 identity fields plus photo selection. */
  const isDirty = useMemo(() => {
    if (!identity || !baselineIdentity) return false;
    if (photoFile) return true;
    return IDENTITY_KEYS.some(
      (key) => identity[key].trim() !== baselineIdentity[key].trim(),
    );
  }, [baselineIdentity, identity, photoFile]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const setField = useCallback(
    <K extends keyof K9EditIdentityValues>(
      key: K,
      value: K9EditIdentityValues[K],
    ) => {
      setValues((current) => (current ? { ...current, [key]: value } : current));
      setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    },
    [],
  );

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cancelling the OS picker must not be read as a removal.
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setErrors((current) => ({
        ...current,
        photo: "Selecione uma imagem PNG, JPG ou WEBP.",
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, photo: "A foto deve ter no máximo 5 MB." }));
      return;
    }
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrors((current) => ({ ...current, form: undefined, photo: undefined }));
  }

  /**
   * Exit controlled by this screen. A dirty identity draft is never discarded
   * silently — it asks for confirmation, reusing the Create V1 dialog pattern.
   * Sidebar/topbar links are outside this screen's control and remain a gap.
   */
  function handleCancel() {
    if (!isDirty) {
      router.push(`${paths.k9}/${encodeURIComponent(dogId)}`);
      return;
    }
    setShowDirtyConfirm(true);
  }

  function confirmDiscard() {
    setShowDirtyConfirm(false);
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    router.push(`${paths.k9}/${encodeURIComponent(dogId)}`);
  }

  /** Logical removal only: becomes clearFields:["profileImageUrl"]. */
  function handleRemovePhoto() {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPhotoFile(null);
    setPreviewUrl("");
    setField("profileImageUrl", "");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    if (!canEditK9) {
      setErrors({ form: "Seu perfil não permite editar este K9." });
      return;
    }
    if (!values || !baselineValues || !identity) return;

    const nextErrors = validateIdentity(identity);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    savingRef.current = true;
    setSaving(true);
    setConflict(false);
    try {
      const result = await saveK9IdentityV1({
        baselineValues,
        dogId,
        photoFile,
        values,
        versionToken,
      });
      router.push(`${paths.k9}/${encodeURIComponent(result.id)}`);
    } catch (error) {
      await handleSaveError(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  /**
   * FAILED_PRECONDITION covers both stale concurrency and archived K9, so the
   * distinction comes from re-reading the current document — never from
   * matching the backend's message text.
   */
  async function handleSaveError(error: unknown) {
    const typed =
      error instanceof K9EditError
        ? error
        : new K9EditError("UNKNOWN", "Não foi possível salvar as alterações.");

    if (typed.category === "PRECONDITION_FAILED") {
      try {
        const current = await loadK9ForEdit(dogId);
        if (current?.archived) {
          setLoadState("archived");
          return;
        }
      } catch {
        // Re-read failed: fall through to conflict, which preserves the draft.
      }
      setConflict(true);
      return;
    }

    switch (typed.category) {
      case "ALREADY_EXISTS":
        setErrors((current) => ({
          ...current,
          registrationNumber: "Esta matrícula já está cadastrada em outro K9.",
        }));
        return;
      case "PERMISSION_DENIED":
        setErrors({ form: "Seu perfil não permite editar este K9." });
        return;
      case "UNAUTHENTICATED":
        setErrors({ form: "Sua sessão expirou. Entre novamente para continuar." });
        return;
      case "NON_IDENTITY_DIRTY":
        setErrors({ form: typed.message });
        return;
      case "REQUIRED_FIELD_MISSING":
        setErrors({ form: "Preencha os campos obrigatórios antes de salvar." });
        return;
      case "INVALID_ARGUMENT":
        setErrors({
          form: "Não foi possível salvar: dados inválidos para o cadastro administrativo.",
        });
        return;
      default:
        setErrors({ form: "Não foi possível salvar as alterações. Tente novamente." });
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex h-96 items-center justify-center" role="status">
        <Loader aria-hidden className="h-6 w-6 animate-spin text-cyan-300" />
        <span className="ml-3 text-sm text-slate-400">Carregando cadastro...</span>
      </div>
    );
  }

  if (loadState === "archived") {
    return <K9EditArchivedState dogId={dogId} />;
  }

  if (loadState === "missing" || loadState === "error" || !values || !identity) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-red-300/20 bg-red-300/[0.06]">
        <div className="flex items-center gap-3">
          <CircleAlert aria-hidden className="h-5 w-5 text-red-300" />
          <p className="text-sm text-red-200">
            {loadState === "missing"
              ? "K9 não localizado para edição."
              : "Falha ao carregar o cadastro."}
          </p>
        </div>
      </div>
    );
  }

  if (!canEditK9) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-red-300/20 bg-red-300/[0.06]">
        <div className="flex items-center gap-3">
          <CircleAlert aria-hidden className="h-5 w-5 text-red-300" />
          <p className="text-sm text-red-200">
            Seu perfil não permite editar K9.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <form
      className="grid gap-6 wide:grid-cols-[minmax(0,1fr)_22rem] wide:gap-8"
      onSubmit={handleSubmit}
    >
      <div className="min-w-0 space-y-5">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <Dog aria-hidden className="h-6 w-6 text-cyan-300" />
            <h1 className="text-2xl font-black tracking-tight text-white">
              Editar K9
            </h1>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Identidade e dados administrativos. Saúde, vínculos e formação são
            gerenciados em seus módulos.
          </p>
        </div>

        {conflict ? (
          <K9EditConflictNotice onReload={() => setReloadKey((key) => key + 1)} />
        ) : null}

        {errors.form ? (
          <div
            className="flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100"
            role="alert"
          >
            <CircleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{errors.form}</div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            Identidade do K9
          </h2>
          <div className="grid gap-5 sm:grid-cols-[minmax(160px,196px)_minmax(0,1fr)] sm:gap-6">
            <div className="mx-auto w-full max-w-[180px] sm:mx-0 sm:max-w-none">
              <K9EditPhoto
                error={errors.photo}
                onPhotoChange={handlePhoto}
                onRemove={handleRemovePhoto}
                previewUrl={previewUrl}
              />
            </div>
            <K9EditMainData
              errors={errors}
              onChange={setField}
              values={identity}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            Características
          </h2>
          <K9EditTraits errors={errors} onChange={setField} values={identity} />
        </section>

        <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            Observações
          </h2>
          <K9EditNotes
            onChange={(value) => setField("notes", value)}
            value={identity.notes}
          />
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-400 transition hover:border-white/20 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:opacity-50 sm:min-w-[9rem]"
            disabled={saving}
            onClick={handleCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-300/90 px-6 py-3 text-sm font-black text-[#052029] shadow-[0_10px_30px_rgba(77,208,225,0.22)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07131b] disabled:opacity-60 sm:min-w-[13rem]"
            disabled={saving || !isDirty}
            type="submit"
          >
            {saving ? (
              <>
                <Loader aria-hidden className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check aria-hidden className="h-4 w-4" />
                Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>

      <K9EditOperationalContext
        conductorRa={values.conductorRa}
        dogId={dogId}
        idealWeightMax={values.idealWeightMax}
        idealWeightMin={values.idealWeightMin}
        operationalStatus={values.operationalStatus}
        physicalCondition={values.physicalCondition}
        specialties={values.specialties}
        weight={values.weight}
      />
    </form>

    {showDirtyConfirm ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div
          aria-labelledby="k9-edit-discard-title"
          aria-modal="true"
          className="w-full max-w-sm rounded-2xl border border-amber-300/20 bg-[#0b1628] p-6 shadow-2xl"
          role="dialog"
        >
          <h2
            className="text-lg font-black text-white"
            id="k9-edit-discard-title"
          >
            Descartar alterações?
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Há alterações não salvas neste cadastro.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              className="flex-1 rounded-xl border border-slate-400/20 bg-slate-400/[0.08] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-slate-400/[0.15]"
              onClick={() => setShowDirtyConfirm(false)}
              type="button"
            >
              Continuar editando
            </button>
            <button
              className="flex-1 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2.5 text-xs font-bold text-amber-200 transition hover:bg-amber-300/[0.15]"
              onClick={confirmDiscard}
              type="button"
            >
              Descartar
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
