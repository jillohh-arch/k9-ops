import { AlertTriangle } from "lucide-react";

import { humanizeSourceErrors } from "@/lib/errors/user-facing-errors";

export function SourceWarning({
  errors,
  title = "Alguns dados não estão disponíveis.",
}: {
  errors: string[];
  title?: string;
}) {
  const messages = humanizeSourceErrors(errors);
  if (!messages.length) return null;

  return (
    <section className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-black">{title}</p>
          <p className="mt-1 text-amber-100/70">
            A tela continua disponível, mas alguns indicadores podem aparecer
            incompletos.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-amber-50/75">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
