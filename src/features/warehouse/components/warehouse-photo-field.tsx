"use client";

import React, { useEffect, useId, useMemo, useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { validateWarehousePhotoFile } from "../data/warehouse-service";
import { WarehouseItemThumbnail } from "../presentation/warehouse-motion";

export interface WarehousePhotoFieldProps {
  label?: string;
  categoryName?: string;
  currentPhotoUrl?: string | null;
  selectedFile: File | null;
  isRemoved: boolean;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  error?: string | null;
  onErrorChange?: (err: string | null) => void;
  inputId?: string;
}

export function WarehousePhotoField({
  label = "Foto do Item",
  categoryName = "Geral",
  currentPhotoUrl,
  selectedFile,
  isRemoved,
  onFileSelect,
  onRemove,
  disabled = false,
  error,
  onErrorChange,
  inputId,
}: WarehousePhotoFieldProps) {
  const generatedId = useId();
  const fieldId = inputId || `warehouse-photo-${generatedId}`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localBlobUrl = useMemo(() => {
    if (selectedFile && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      return URL.createObjectURL(selectedFile);
    }
    return null;
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (localBlobUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [localBlobUrl]);

  const activePhotoSrc = isRemoved ? null : (localBlobUrl || currentPhotoUrl || null);
  const hasPhoto = Boolean(activePhotoSrc);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateWarehousePhotoFile(file);
    if (validationError) {
      if (onErrorChange) onErrorChange(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (onErrorChange) onErrorChange(null);
    onFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full sm:w-36 shrink-0 flex flex-col items-center">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5 self-start">
        {label}
      </span>

      <label
        htmlFor={fieldId}
        className={`group relative block h-32 w-32 sm:h-36 sm:w-36 cursor-pointer overflow-hidden rounded-2xl border transition-all duration-200 ${
          error
            ? "border-rose-500/50 ring-2 ring-rose-500/20"
            : "border-white/10 hover:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-400/60"
        } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
      >
        <WarehouseItemThumbnail
          src={activePhotoSrc}
          categoryName={categoryName}
          size="fill"
          alt={label}
        />

        {/* Action strip overlay */}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 border-t border-white/10 bg-[#07131b]/90 px-2 py-2 text-[11px] font-bold text-cyan-200 backdrop-blur-sm transition group-hover:bg-[#07131b]/95">
          <ImagePlus aria-hidden className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>{hasPhoto ? "Trocar foto" : "Adicionar foto"}</span>
        </span>

        <input
          ref={fileInputRef}
          id={fieldId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleInputChange}
          disabled={disabled}
          className="sr-only"
          aria-describedby={`${fieldId}-help`}
        />
      </label>

      {hasPhoto && !disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 flex w-full max-w-[144px] items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
        >
          <Trash2 aria-hidden className="h-3 w-3" />
          <span>Remover foto</span>
        </button>
      )}

      <p id={`${fieldId}-help`} className="mt-1.5 text-center text-[10px] text-slate-500">
        JPG, PNG, WEBP · até 5 MB
      </p>

      {error && (
        <p role="alert" className="mt-1 text-center text-[11px] font-medium text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
