"use client";

import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { CircleAlert, Dog, Loader, Check } from "lucide-react";

import { K9CreateIdentity } from "./k9-create-identity";
import { K9CreatePhoto } from "./k9-create-photo";
import { K9CreateComplementary } from "./k9-create-complementary";
import { K9CreatePreview } from "./k9-create-preview";
import { saveNewK9V1 } from "./k9-create-adapter";
import type { K9CreateFormValues } from "./k9-create-types";

type FieldErrors = Partial<Record<keyof K9CreateFormValues | "form", string>>;

const emptyValues: K9CreateFormValues = {
  name: "",
  registrationNumber: "",
  breed: "",
  // Sexo é obrigatório: começa vazio para forçar escolha consciente, em vez de
  // deixar "Macho" pré-selecionado e virar o padrão silencioso do cadastro.
  sex: "",
  birthDate: "",
  color: "",
  size: "",
  microchip: "",
  notes: "",
  profileImageUrl: "",
};

function validate(values: K9CreateFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.name.trim()) {
    errors.name = "Informe o nome operacional.";
  }

  if (!values.registrationNumber.trim()) {
    errors.registrationNumber = "Informe a matrícula/RGA.";
  }

  if (!values.breed.trim()) {
    errors.breed = "Informe a raça.";
  }

  if (!values.sex) {
    errors.sex = "Informe o sexo.";
  }

  if (!values.birthDate) {
    errors.birthDate = "Informe a data de nascimento.";
  } else {
    try {
      const date = new Date(values.birthDate);
      const today = new Date();
      if (date > today) {
        errors.birthDate = "A data não pode ser futura.";
      }
    } catch {
      errors.birthDate = "Data inválida.";
    }
  }

  return errors;
}

export function K9CreateForm() {
  const router = useRouter();
  const { can } = useAccessControl();
  const { profile } = useAuth();

  const [values, setValues] = useState<K9CreateFormValues>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);

  const canCreateK9 = can("k9", "create");

  // Dirty state is derived, not stored: any field differing from the empty
  // baseline, or a selected photo, means there's unsaved work to protect.
  const isDirty = useMemo(
    () =>
      Object.entries(values).some(
        ([key, value]) => value !== emptyValues[key as keyof K9CreateFormValues]
      ) || photoFile !== null,
    [values, photoFile]
  );

  // Protect against unload when dirty
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  function setField<Key extends keyof K9CreateFormValues>(
    key: Key,
    value: K9CreateFormValues[Key]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setPhotoError("Selecione uma imagem PNG, JPG ou WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("A foto deve ter no máximo 5 MB.");
      return;
    }

    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPhotoError(undefined);
    setErrors((current) => ({ ...current, form: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length || !profile || !canCreateK9) {
      return;
    }

    setSaving(true);
    try {
      const dogId = await saveNewK9V1({
        photoFile,
        profile,
        values,
      });
      router.push(`/k9/${encodeURIComponent(dogId)}`);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error ? error.message : "Falha ao cadastrar o K9.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!isDirty) {
      router.back();
      return;
    }

    setShowDirtyConfirm(true);
  }

  function confirmCancel() {
    setShowDirtyConfirm(false);
    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    router.back();
  }

  if (!profile || !canCreateK9) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-red-300/20 bg-red-300/[0.06]">
        <div className="flex items-center gap-3">
          <CircleAlert className="h-5 w-5 text-red-300" />
          <p className="text-sm text-red-200">
            Seu perfil não permite criar K9.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="grid gap-6 wide:grid-cols-[minmax(0,1fr)_24rem] wide:gap-8"
      >
        {/* Main form area */}
        <div className="min-w-0 space-y-5">
          {/* Header */}
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <Dog className="h-6 w-6 text-cyan-300" />
              <h1 className="text-2xl font-black tracking-tight text-white">Novo K9</h1>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Cadastre a identidade do novo K9. Saúde, vínculos e formação são
              configurados em seus módulos.
            </p>
          </div>

          {/* Form error */}
          {errors.form ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>{errors.form}</div>
            </div>
          ) : null}

          {/*
            Bloco de identidade: foto e campos vivem no mesmo card para que a
            tela leia como UMA composição de identidade, não dois cards soltos.
            A foto retrato só ganha coluna própria a partir de `sm`; abaixo
            disso empilha e fica compacta.
          */}
          <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Identidade do K9
            </h2>
            <div className="grid gap-5 sm:grid-cols-[minmax(160px,208px)_minmax(0,1fr)] sm:gap-6">
              <div className="mx-auto w-full max-w-[192px] sm:mx-0 sm:max-w-none">
                <K9CreatePhoto
                  error={photoError}
                  hasPhoto={Boolean(previewUrl)}
                  onPhotoChange={handlePhoto}
                  previewUrl={previewUrl}
                />
              </div>
              <K9CreateIdentity
                breed={values.breed}
                birthDate={values.birthDate}
                breedError={errors.breed}
                birthDateError={errors.birthDate}
                name={values.name}
                nameError={errors.name}
                onBreedChange={(v) => setField("breed", v)}
                onBirthDateChange={(v) => setField("birthDate", v)}
                onNameChange={(v) => setField("name", v)}
                onRegistrationNumberChange={(v) =>
                  setField("registrationNumber", v)
                }
                onSexChange={(v) => setField("sex", v)}
                registrationNumber={values.registrationNumber}
                registrationNumberError={errors.registrationNumber}
                sex={values.sex}
                sexError={errors.sex}
              />
            </div>
          </section>

          {/* Complementary section */}
          <K9CreateComplementary
            color={values.color}
            microchip={values.microchip}
            notes={values.notes}
            size={values.size}
            onColorChange={(v) => setField("color", v)}
            onMicrochipChange={(v) => setField("microchip", v)}
            onNotesChange={(v) => setField("notes", v)}
            onSizeChange={(v) => setField("size", v)}
          />

          {/* Action bar */}
          {/*
            Hierarquia: o primário carrega peso (fundo cyan sólido, glow
            discreto) e mais largura; o secundário fica em texto/contorno.
          */}
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-400 transition hover:border-white/20 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:opacity-50 sm:min-w-[9rem]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-300/90 px-6 py-3 text-sm font-black text-[#052029] shadow-[0_10px_30px_rgba(77,208,225,0.22)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07131b] disabled:opacity-60 sm:min-w-[13rem]"
            >
              {saving ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Cadastrar K9
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview sidebar — vira coluna própria só a partir de xl. */}
        <div className="min-w-0">
          <K9CreatePreview
            birthDate={values.birthDate}
            breed={values.breed}
            color={values.color}
            microchip={values.microchip}
            name={values.name}
            profileImageUrl={previewUrl || values.profileImageUrl}
            registrationNumber={values.registrationNumber}
            sex={values.sex}
            size={values.size}
          />
        </div>
      </form>

      {/* Dirty confirmation dialog */}
      {showDirtyConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-amber-300/20 bg-[#0b1628] p-6 shadow-2xl">
            <h2 className="text-lg font-black text-white">Descartar alterações?</h2>
            <p className="mt-2 text-sm text-slate-400">
              Há campos preenchidos que serão descartados se você sair desta
              página.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDirtyConfirm(false)}
                className="flex-1 rounded-xl border border-slate-400/20 bg-slate-400/[0.08] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-slate-400/[0.15]"
              >
                Continuar preenchendo
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                className="flex-1 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2.5 text-xs font-bold text-amber-200 transition hover:bg-amber-300/[0.15]"
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
