"use client";

import React from "react";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Lock,
  MinusCircle,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  CustodyPurpose,
  EquipmentCondition,
  EquipmentStatus,
  StockBatchStatus,
  StockMovementType,
} from "../domain/contracts";
import { AlertSeverity } from "../domain/overview";

/**
 * Human-friendly PT-BR labels for internal enum keys
 */
export function formatCustodyPurpose(purpose: CustodyPurpose | string): string {
  switch (purpose) {
    case "daily_duty":
      return "Serviço diário";
    case "training":
      return "Treinamento / Instrução";
    case "operation":
      return "Operação especial";
    case "permanent_assignment":
      return "Cautela permanente";
    default:
      return purpose;
  }
}

export function formatEquipmentCondition(condition: EquipmentCondition | string): string {
  switch (condition) {
    case "new":
      return "Novo";
    case "good":
      return "Bom";
    case "fair":
      return "Regular";
    case "damaged":
      return "Danificado";
    default:
      return condition;
  }
}

export function formatEquipmentStatus(status: EquipmentStatus | string): string {
  switch (status) {
    case "available":
      return "Disponível";
    case "in_custody":
      return "Em cautela";
    case "maintenance":
      return "Manutenção";
    case "damaged":
      return "Danificado";
    case "retired":
      return "Baixado";
    default:
      return status;
  }
}

export function formatBatchStatus(status: StockBatchStatus | string): string {
  switch (status) {
    case "active":
      return "Ativo";
    case "depleted":
      return "Esgotado";
    case "blocked":
      return "Bloqueado";
    default:
      return status;
  }
}

export function formatMovementType(type: StockMovementType | string): string {
  switch (type) {
    case "entry":
      return "Entrada";
    case "consumption":
      return "Saída / Consumo";
    case "transfer":
      return "Transferência";
    case "inventory_adjustment":
      return "Ajuste de inventário";
    case "loss":
      return "Perda";
    case "disposal":
      return "Descarte";
    default:
      return type;
  }
}

/**
 * Formata strings de data no formato AAAA-MM-DD para DD/MM/AAAA sem risco de
 * rollback de fuso horário (UTC -> local).
 * Seguro para fusos horários negativos como America/Sao_Paulo (UTC-3).
 */
export function formatDateOnly(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const matchPrefix = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (matchPrefix) {
    const [, year, month, day] = matchPrefix;
    return `${day}/${month}/${year}`;
  }
  return fallback;
}

/**
 * R2 Presentation Badges using Lucide Icons (Zero emoji)
 */

export function ConditionBadge({ condition }: { condition: EquipmentCondition | string }) {
  switch (condition) {
    case "new":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          <Sparkles className="h-3 w-3 text-emerald-400" /> Novo
        </span>
      );
    case "good":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
          <ShieldCheck className="h-3 w-3 text-cyan-400" /> Bom
        </span>
      );
    case "fair":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
          <AlertCircle className="h-3 w-3 text-amber-400" /> Regular
        </span>
      );
    case "damaged":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-300">
          <AlertTriangle className="h-3 w-3 text-rose-400" /> Danificado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          {condition}
        </span>
      );
  }
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus | string }) {
  switch (status) {
    case "available":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          <Check className="h-3 w-3 text-emerald-400" /> Disponível
        </span>
      );
    case "in_custody":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
          <UserCheck className="h-3 w-3 text-cyan-400" /> Em Cautela
        </span>
      );
    case "maintenance":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
          <Wrench className="h-3 w-3 text-amber-400" /> Manutenção
        </span>
      );
    case "damaged":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-300">
          <AlertTriangle className="h-3 w-3 text-rose-400" /> Danificado
        </span>
      );
    case "retired":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-800/40 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          <Archive className="h-3 w-3 text-slate-500" /> Baixado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          {status}
        </span>
      );
  }
}

export function DueBadge({ dueState }: { dueState: "on_time" | "due_today" | "overdue" }) {
  switch (dueState) {
    case "on_time":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> No Prazo
        </span>
      );
    case "due_today":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
          <Clock className="h-3 w-3 text-amber-400" /> Vence Hoje
        </span>
      );
    case "overdue":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-300">
          <AlertOctagon className="h-3 w-3 text-rose-400" /> Atrasada
        </span>
      );
  }
}

export function BatchTemporalBadge({ state }: { state: "valid" | "expiring_soon" | "expired" }) {
  switch (state) {
    case "expired":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-300">
          <AlertOctagon className="h-3 w-3 text-rose-400" /> Vencido
        </span>
      );
    case "expiring_soon":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
          <Clock className="h-3 w-3 text-amber-400" /> Vence em Breve
        </span>
      );
    case "valid":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Válido
        </span>
      );
  }
}

export function BatchStatusBadge({ status }: { status: StockBatchStatus | string }) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          <Check className="h-3 w-3 text-emerald-400" /> Ativo
        </span>
      );
    case "depleted":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          <MinusCircle className="h-3 w-3 text-slate-500" /> Esgotado
        </span>
      );
    case "blocked":
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-300">
          <Lock className="h-3 w-3 text-rose-400" /> Bloqueado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          {status}
        </span>
      );
  }
}

export function MovementTypeBadge({ type }: { type: StockMovementType | string }) {
  switch (type) {
    case "entry":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          <ArrowDownLeft className="h-3 w-3 text-emerald-400" /> Entrada
        </span>
      );
    case "consumption":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
          <ArrowUpRight className="h-3 w-3 text-sky-400" /> Saída
        </span>
      );
    case "transfer":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-300">
          <ArrowLeftRight className="h-3 w-3 text-purple-400" /> Transferência
        </span>
      );
    case "inventory_adjustment":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
          <Sliders className="h-3 w-3 text-amber-400" /> Ajuste Inv.
        </span>
      );
    case "loss":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
          <XCircle className="h-3 w-3 text-rose-400" /> Perda
        </span>
      );
    case "disposal":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
          <Archive className="h-3 w-3 text-slate-400" /> Descarte
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          {type}
        </span>
      );
  }
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  switch (severity) {
    case "critical":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200 uppercase tracking-wider">
          <AlertOctagon className="h-2.5 w-2.5 text-rose-400" /> Crítico
        </span>
      );
    case "warning":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 uppercase tracking-wider">
          <AlertTriangle className="h-2.5 w-2.5 text-amber-400" /> Atenção
        </span>
      );
    case "info":
      return (
        <span className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200 uppercase tracking-wider">
          <Layers className="h-2.5 w-2.5 text-cyan-400" /> Info
        </span>
      );
  }
}
