"use client";

import {
  ArrowLeft,
  CalendarDays,
  Dog,
  IdCard,
  Pencil,
  Scale,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import {
  EntityImage,
  StatusPill,
} from "@/features/effective/components/effective-ui";
import { profileText, type ProfileRecord } from "@/features/effective/hooks/use-k9-profile-data";
import { specialtyLabel } from "@/features/effective/hooks/use-effective-data";
import { paths } from "@/lib/routes/paths";

import { ageLabel, type ProfileView } from "./k9-profile-types";

export function K9ProfileHeader({
  canEdit,
  dogId,
  view,
}: {
  canEdit: boolean;
  dogId: string;
  view: ProfileView;
}) {
  const { name, breed, sex, birthDate, registration, imageUrl, status } = view;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-bold text-slate-400 transition hover:text-white"
          href={paths.effective}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao efetivo
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/[0.12]"
              href={`/k9/${encodeURIComponent(dogId)}/edit`}
            >
              <Pencil className="h-4 w-4" />
              Editar cadastro
            </Link>
          ) : null}
          <span className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-semibold text-slate-400">
            Perfil consultivo
          </span>
          <StatusPill label={status.label} tone={status.tone} />
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-surface-card/90 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.26)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.12),transparent_32%),linear-gradient(125deg,transparent_62%,rgba(59,130,246,0.08))]" />
        <div className="relative grid gap-6 lg:grid-cols-[210px_1fr]">
          <EntityImage
            alt={name}
            className="h-[210px] w-full"
            fallback={Dog}
            src={imageUrl}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-4xl font-black text-white">{name}</h2>
              <StatusPill label={status.label} tone={status.tone} />
            </div>
            <p className="mt-2 font-mono text-sm font-bold text-cyan-300">
              MAT. {registration}
            </p>
            <div className="mt-5 grid gap-4 border-y border-white/8 py-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: Dog, label: "Raça", value: breed },
                { icon: IdCard, label: "Sexo", value: sex },
                { icon: CalendarDays, label: "Idade", value: ageLabel(birthDate) },
                {
                  icon: Scale,
                  label: "Peso atual",
                  value:
                    view.currentWeight == null
                      ? "Sem registro"
                      : `${view.currentWeight.toFixed(1)} kg`,
                },
              ].map((item) => (
                <div className="flex items-center gap-3" key={item.label}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.045] text-cyan-200">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-200">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {view.specialtyRecords.length ? (
                view.specialtyRecords.map((specialty) => (
                  <span
                    className="rounded-lg border border-blue-300/20 bg-blue-300/8 px-3 py-1.5 text-xs font-semibold text-blue-200"
                    key={specialty._id}
                  >
                    {specialtyLabel(
                      profileText(specialty, ["modality", "type", "name"]) ??
                        specialty._id,
                    )}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">
                  Nenhuma especialidade ativa registrada.
                </span>
              )}
            </div>
            {view.conductor ? (
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.045] text-cyan-200">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="text-sm">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Condutor
                  </p>
                  <p className="font-bold text-slate-200">
                    {profileText(view.conductor, ["name", "nome", "fullName"]) ??
                      "Não identificado"}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
