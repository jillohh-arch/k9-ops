"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { CircleAlert, Check, Loader, UserPlus } from "lucide-react";

import { HumanCreateContact } from "./human-create-contact";
import { HumanCreateFunctional } from "./human-create-functional";
import { HumanCreateIdentity } from "./human-create-identity";
import { HumanCreatePhotoSeam } from "./human-create-photo-seam";
import { createHumanV1 } from "./human-create-service";
import {
  emptyHumanCreateValues,
  type HumanCreateFormValues,
} from "./human-create-types";

type FieldErrors = Partial<Record<keyof HumanCreateFormValues | "form", string>>;

// Espelha o contrato do backend (assertRa): apenas dígitos, 4 a 12.
const RA_PATTERN = /^\d{4,12}$/;

/**
 * Validação client alinhada ao contrato homologado do `adminCreateHuman`:
 * required = ra/fullName/callsign; ra casa ^\d{4,12}$. Os demais campos de
 * pessoal são OPCIONAIS — não replicamos a exigência de accessProfileId do
 * HumanAdminForm legado. birthDate/email só são checados quando preenchidos.
 */
function validate(values: HumanCreateFormValues): FieldErrors {
  const errors: FieldErrors = {};

  const ra = values.ra.trim();
  if (!ra) {
    errors.ra = "Informe o RA.";
  } else if (!RA_PATTERN.test(ra)) {
    errors.ra = "RA deve conter apenas números (4 a 12 dígitos).";
  }

  if (!values.fullName.trim()) {
    errors.fullName = "Informe o nome completo.";
  }

  if (!values.callsign.trim()) {
    errors.callsign = "Informe o nome de guerra.";
  }

  if (values.birthDate) {
    const date = new Date(values.birthDate);
    if (Number.isNaN(date.getTime())) {
      errors.birthDate = "Data inválida.";
    } else if (date > new Date()) {
      errors.birthDate = "A data não pode ser futura.";
    }
  }

  if (values.institutionalEmail.trim() && !values.institutionalEmail.includes("@")) {
    errors.institutionalEmail = "E-mail inválido.";
  }

  return errors;
}

export function HumanCreateForm() {
  const router = useRouter();
  const { can } = useAccessControl();
  const { profile } = useAuth();

  const [values, setValues] = useState<HumanCreateFormValues>(
    emptyHumanCreateValues,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // Personnel create é governado SOMENTE por humans.create. Nenhum acoplamento
  // com access.create/access.edit: acesso é provisionamento, domínio separado.
  const canCreateHuman = can("humans", "create");

  const isDirty = useMemo(
    () =>
      Object.entries(values).some(
        ([key, value]) =>
          value !== emptyHumanCreateValues[key as keyof HumanCreateFormValues],
      ),
    [values],
  );

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function setField<Key extends keyof HumanCreateFormValues>(
    key: Key,
    value: HumanCreateFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length || !profile || !canCreateHuman) {
      return;
    }

    setSaving(true);
    try {
      const { ra } = await createHumanV1(values);
      router.push(`/humans/${encodeURIComponent(ra)}`);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Falha ao cadastrar o integrante.",
      });
      setSaving(false);
    }
  }

  function handleCancel() {
    router.back();
  }

  if (!profile || !canCreateHuman) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-red-300/20 bg-red-300/[0.06]">
        <div className="flex items-center gap-3">
          <CircleAlert className="h-5 w-5 text-red-300" />
          <p className="text-sm text-red-200">
            Seu perfil não permite cadastrar integrantes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 wide:grid-cols-[minmax(0,1fr)_20rem] wide:gap-8"
    >
      <div className="min-w-0 space-y-5">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <UserPlus className="h-6 w-6 text-cyan-300" />
            <h1 className="text-2xl font-black tracking-tight text-white">
              Novo integrante
            </h1>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Cadastre os dados de pessoal do integrante. Perfil de acesso, foto e
            demais configurações são feitos depois, em seus próprios fluxos.
          </p>
        </div>

        {errors.form ? (
          <div
            className="flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100"
            role="alert"
          >
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{errors.form}</div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            Identificação
          </h2>
          <div className="grid gap-5 sm:grid-cols-[minmax(140px,176px)_minmax(0,1fr)] sm:gap-6">
            <div className="mx-auto w-full max-w-[176px] sm:mx-0 sm:max-w-none">
              <HumanCreatePhotoSeam />
            </div>
            <HumanCreateIdentity
              callsign={values.callsign}
              callsignError={errors.callsign}
              fullName={values.fullName}
              fullNameError={errors.fullName}
              onCallsignChange={(v) => setField("callsign", v)}
              onFullNameChange={(v) => setField("fullName", v)}
              onRaChange={(v) => setField("ra", v)}
              ra={values.ra}
              raError={errors.ra}
            />
          </div>
        </section>

        <HumanCreateFunctional
          admissionDate={values.admissionDate}
          cargo={values.cargo}
          onAdmissionDateChange={(v) => setField("admissionDate", v)}
          onCargoChange={(v) => setField("cargo", v)}
          onRankChange={(v) => setField("rank", v)}
          onTeamChange={(v) => setField("team", v)}
          onUnitChange={(v) => setField("unit", v)}
          rank={values.rank}
          team={values.team}
          unit={values.unit}
        />

        <HumanCreateContact
          birthDate={values.birthDate}
          birthDateError={errors.birthDate}
          cpf={values.cpf}
          institutionalEmail={values.institutionalEmail}
          institutionalEmailError={errors.institutionalEmail}
          notes={values.notes}
          onBirthDateChange={(v) => setField("birthDate", v)}
          onCpfChange={(v) => setField("cpf", v)}
          onInstitutionalEmailChange={(v) => setField("institutionalEmail", v)}
          onNotesChange={(v) => setField("notes", v)}
          onPhoneChange={(v) => setField("phone", v)}
          phone={values.phone}
        />

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
            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-300/90 px-6 py-3 text-sm font-black text-[#052029] shadow-[0_10px_30px_rgba(77,208,225,0.22)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07131b] disabled:opacity-60 sm:min-w-[14rem]"
          >
            {saving ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Cadastrando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Cadastrar integrante
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
