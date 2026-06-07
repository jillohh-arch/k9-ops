import Image from "next/image";
import { Suspense } from "react";
import {
  ClipboardCheck,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { LoginCard } from "@/features/auth/components/login-card";

const assurances = [
  { label: "Acesso restrito", icon: LockKeyhole },
  { label: "Auditoria institucional", icon: ClipboardCheck },
  { label: "Dados protegidos", icon: ShieldCheck },
  { label: "Registro operacional rastreavel", icon: Fingerprint },
];

export default function LoginPage() {
  return (
    <main className="login-screen min-h-dvh overflow-hidden text-slate-100">
      <div className="login-floor" />
      <div className="login-haze login-haze-a" />
      <div className="login-haze login-haze-b" />

      <div className="relative z-10 grid min-h-dvh w-full grid-cols-1 items-center gap-10 px-6 py-10 md:px-10 lg:grid-cols-[520px_minmax(0,1fr)] lg:gap-20 lg:px-20">
        <section className="relative z-20 max-w-[430px]">
          <div>
            <p className="text-4xl font-black tracking-tight text-white md:text-[44px]">
              <span className="text-cyan-300">K9</span> Ops
            </p>
            <p className="mt-3 text-base text-cyan-200/80">
              Gestao Operacional K9
            </p>
          </div>

          <div className="mt-16 h-1 w-10 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(77,208,225,0.9)]" />
          <h1 className="mt-8 max-w-md text-5xl font-black leading-tight tracking-tight text-white md:text-[58px]">
            Acesso Institucional
          </h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-cyan-50/75">
            Entre com suas credenciais para acessar o painel gerencial K9 Ops.
          </p>

          <div className="mt-9 h-px max-w-md bg-gradient-to-r from-cyan-100/20 to-transparent" />

          <p className="mt-8 max-w-md text-base leading-8 text-cyan-50/72">
            Controle administrativo da unidade K9 com acompanhamento de efetivo,
            ocorrencias, saude, treinos e integridade operacional.
          </p>

          <div className="mt-8 space-y-4">
            {assurances.map((item) => (
              <div className="flex items-center gap-4" key={item.label}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/8 text-cyan-300 shadow-[0_0_28px_rgba(0,188,212,0.12)]">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="font-bold text-white">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="relative flex min-h-[620px] -translate-x-7 items-center justify-center">
          <div className="login-watermark" aria-hidden="true">
            <Image
              alt=""
              className="object-contain"
              fill
              priority
              src="/brand/logo-app.png"
              sizes="(min-width: 1024px) 680px, 440px"
            />
          </div>

          <div className="relative z-20 w-full max-w-[690px]">
            <Suspense fallback={null}>
              <LoginCard />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
