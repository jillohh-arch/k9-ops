"use client";

import { ExternalLink, FileText } from "lucide-react";

import {
  profileRecordDate,
  type ProfileRecord,
} from "@/features/effective/lib/k9-profile-records";
import {
  documentOrigin,
  documentTitle,
  documentType,
  documentUrl,
} from "@/features/effective/lib/k9-profile-activity";

import {
  ProfileCard,
  ProfileEmpty,
  ProfileError,
  ProfilePill,
  ProfileSkeleton,
} from "./k9-profile-ui";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export type K9ProfileDocumentsProps = {
  documents: ProfileRecord[];
  error: string | null;
  loading: boolean;
};

/**
 * Aba Documentos — lista real, sem mudança de schema.
 *
 * Não há `category` nem separação clínico/administrativo: essa distinção não
 * existe no dado hoje (seção 20). Também não há upload novo — a única ação é
 * abrir o arquivo, e apenas quando existe URL real.
 */
export function K9ProfileDocuments({
  documents,
  error,
  loading,
}: K9ProfileDocumentsProps) {
  return (
    <div className="space-y-4">
      {error ? (
        <ProfileError>Falha ao carregar documentos: {error}</ProfileError>
      ) : null}

      <ProfileCard title="Documentos do K9">
        {loading && !documents.length ? (
          <div className="space-y-3">
            <ProfileSkeleton className="h-12" />
            <ProfileSkeleton className="h-12" />
          </div>
        ) : documents.length ? (
          <ul className="space-y-0">
            {documents.map((document, index) => {
              const date = profileRecordDate(document);
              const url = documentUrl(document);
              const type = documentType(document);
              const origin = documentOrigin(document);
              return (
                <li
                  className={
                    index < documents.length - 1
                      ? "border-b border-white/[0.05] pb-3 pt-3 first:pt-0"
                      : "pt-3 first:pt-0"
                  }
                  key={`${document._source ?? "document"}:${document._id}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"
                    >
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-slate-100">
                        {documentTitle(document)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-mono">
                          {date ? dateFormatter.format(date) : "Sem data"}
                        </span>
                        {origin ? (
                          <>
                            <span aria-hidden className="text-slate-700">
                              ·
                            </span>
                            <span className="truncate">{origin}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {type ? <ProfilePill label={type} /> : null}
                    {url ? (
                      <a
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                        href={url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                        Abrir
                      </a>
                    ) : (
                      <span className="shrink-0 text-[11px] text-slate-600">
                        Sem arquivo
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ProfileEmpty>
            Nenhum documento registrado para este K9.
          </ProfileEmpty>
        )}
      </ProfileCard>
    </div>
  );
}
