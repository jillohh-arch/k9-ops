"use client";

import Image from "next/image";
import { Dog, ShieldCheck } from "lucide-react";

import { ProfileCard, ProfileField, ProfilePill } from "../k9-profile-v1/k9-profile-ui";

function formatDate(value: string) {
  if (!value) return "Não informado";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "Não informado"
    : date.toLocaleDateString("pt-BR");
}

function age(value: string) {
  if (!value) return "Não informado";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Não informado";
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  if (
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())
  ) {
    years -= 1;
  }
  return `${Math.max(0, years)} ${years === 1 ? "ano" : "anos"}`;
}

export function K9CreatePreview({
  birthDate,
  breed,
  color,
  microchip,
  name,
  profileImageUrl,
  registrationNumber,
  sex,
  size,
}: {
  birthDate: string;
  breed: string;
  color: string;
  microchip: string;
  name: string;
  profileImageUrl: string;
  registrationNumber: string;
  sex: string;
  size: string;
}) {
  const displayName = name.trim() || "Nome do K9";

  return (
    <div className="space-y-4 wide:sticky wide:top-24">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          Prévia do perfil
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Atualiza enquanto você preenche o cadastro.
        </p>
      </div>

      <ProfileCard className="overflow-hidden p-0">
        <div className="relative aspect-[5/4] w-full bg-[radial-gradient(circle_at_50%_20%,rgba(77,208,225,0.1),transparent_42%),#071019]">
          {profileImageUrl ? (
            <Image
              alt={`Prévia da foto de ${displayName}`}
              className="object-cover"
              fill
              src={profileImageUrl}
              unoptimized={profileImageUrl.startsWith("blob:")}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-600">
              <Dog className="h-11 w-11" />
              <span className="text-[10px] uppercase tracking-wider">
                Sem foto
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07131b] via-[#07131b]/78 to-transparent p-5 pt-14">
            <div className="flex items-end justify-between gap-2">
              <h2 className="min-w-0 truncate text-2xl font-black leading-tight tracking-tight text-white">
                {displayName}
              </h2>
              <ProfilePill label="Cadastro ativo" tone="green" />
            </div>
            <p className="mt-1.5 truncate text-sm text-slate-300">
              {breed.trim() || "Raça não informada"}
            </p>
          </div>
        </div>

        <div className="p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <ProfileField
              label="Matrícula"
              mono
              value={registrationNumber.trim() || "Não informado"}
            />
            <ProfileField
              label="Sexo"
              value={sex === "F" ? "Fêmea" : sex === "M" ? "Macho" : "Não informado"}
            />
            <ProfileField label="Nascimento" value={formatDate(birthDate)} />
            <ProfileField label="Idade" value={age(birthDate)} />
            <ProfileField label="Pelagem" value={color.trim() || "Não informado"} />
            <ProfileField label="Porte" value={size.trim() || "Não informado"} />
            <div className="col-span-2 border-t border-cyan-200/10 pt-4">
              <ProfileField
                label="Microchip"
                mono
                value={microchip.trim() || "Não informado"}
              />
            </div>
          </dl>
        </div>
      </ProfileCard>

      <div className="flex gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        <p className="text-xs leading-relaxed text-slate-400">
          Prontidão clínica e dados de saúde são avaliados no módulo Saúde.
        </p>
      </div>
    </div>
  );
}
