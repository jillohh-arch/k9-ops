"use client";

import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/providers/auth-provider";
import {
  getAuthErrorMessage,
  normalizeRa,
  sanitizeNextPath,
  sendPasswordResetForRa,
  signInWithRa,
} from "@/features/auth/services/auth-service";
import { paths } from "@/lib/routes/paths";

export function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useAuth();
  const [ra, setRa] = useState("");
  const [password, setPassword] = useState("");
  const [keepConnected, setKeepConnected] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const nextPath = sanitizeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await signInWithRa(ra, password, keepConnected);
      router.replace(nextPath || paths.dashboard);
      router.refresh();
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    setError(null);
    setSuccess(null);

    if (!ra.trim()) {
      setError("Informe seu RA antes de solicitar a recuperação.");
      return;
    }

    setIsResetting(true);

    try {
      await sendPasswordResetForRa(ra);
      setSuccess("Enviamos as instruções de recuperação vinculadas ao RA informado.");
    } catch (caughtError) {
      setError(getAuthErrorMessage(caughtError));
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-cyan-300/25 bg-slate-950/65 p-6 shadow-[0_0_80px_rgba(0,188,212,0.18)] backdrop-blur-2xl sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />

      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
          Acesso seguro
        </p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
          Acesso Institucional
        </h2>
        <p className="mt-3 text-sm leading-6 text-cyan-50/70 md:text-base">
          Use suas credenciais autorizadas para entrar no painel.
        </p>

        <form className="mt-9 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2.5">
            <Label htmlFor="ra">RA</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-100/65" />
              <Input
                className="h-14 rounded-xl border-cyan-100/20 bg-slate-900/70 pl-12 text-base shadow-inner shadow-black/20"
                id="ra"
                autoComplete="username"
                inputMode="numeric"
                maxLength={12}
                onChange={(event) => setRa(normalizeRa(event.target.value))}
                pattern="[0-9]*"
                placeholder="Digite seu RA"
                required
                value={ra}
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-100/65" />
              <Input
                className="h-14 rounded-xl border-cyan-100/20 bg-slate-900/70 pl-12 pr-12 text-base shadow-inner shadow-black/20"
                id="password"
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-100/65 transition hover:text-cyan-100"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-cyan-50/70">
            <input
              checked={keepConnected}
              className="h-5 w-5 rounded border-cyan-200/30 bg-slate-950 text-cyan-300 accent-cyan-300"
              onChange={(event) => setKeepConnected(event.target.checked)}
              type="checkbox"
            />
            Manter conectado neste dispositivo
          </label>

          {error ? (
            <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <Button
            className="h-14 w-full rounded-xl text-base font-black shadow-[0_18px_48px_rgba(0,188,212,0.28)]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Entrando..." : "Entrar no painel"}
          </Button>
        </form>

        <button
          className="mx-auto mt-6 flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-100"
          disabled={isResetting}
          onClick={handlePasswordReset}
          type="button"
        >
          {isResetting ? "Enviando..." : "Esqueci minha senha"}
          <ArrowRight className="h-4 w-4" />
        </button>

        <div className="mt-10 border-t border-white/10 pt-7">
          <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="max-w-sm text-sm leading-6 text-cyan-50/70">
                Ambiente seguro. Acesso monitorado e restrito a usuários
                autorizados.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-300/10 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-cyan-50">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
              Sistema online
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
