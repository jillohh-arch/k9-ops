/**
 * Health Web v1 — Technical State Components
 *
 * Based on:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §25 (Technical States)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §37 (Technical State Patterns)
 *
 * These components render the appropriate UI for each technical read state.
 */
import { AlertCircle, AlertTriangle, Ban, FileQuestion, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ReadState,
  ReadStateError,
  ReadStateForbidden,
  ReadStateNotFound,
  ReadStateUnauthorized,
  ReadStateEmpty,
  ReadStateLoading,
  ReadStatePartial,
  ReadStateDegraded,
  ReadStateStale,
  ReadStateLegacy,
  ReadStateConflict,
  ReadStateRefreshing,
  ReadStateSuccess,
  ReadStateIdle,
} from "@/features/health/domain/read-states";

// ============================================================================
// State Indicator Component
// ============================================================================

interface StateIndicatorProps {
  status: ReadState["status"];
  className?: string;
}

/**
 * Visual indicator for a technical state.
 * Shows an icon appropriate for the state.
 */
export function StateIndicator({ status, className }: StateIndicatorProps) {
  const icons: Record<string, typeof Loader2> = {
    idle: Loader2,
    loading: Loader2,
    refreshing: RefreshCw,
    success: Loader2, // No icon for success, using fallback
    empty: FileQuestion,
    partial: AlertTriangle,
    degraded: AlertTriangle,
    stale: AlertCircle,
    legacy: FileQuestion,
    conflict: AlertCircle,
    unauthorized: Ban,
    forbidden: Ban,
    not_found: FileQuestion,
    error: AlertCircle,
  };

  const labels: Record<string, string> = {
    idle: "Aguardando",
    loading: "Carregando",
    refreshing: "Atualizando",
    success: "Sucesso",
    empty: "Vazio",
    partial: "Parcial",
    degraded: "Degradado",
    stale: "Desatualizado",
    legacy: "Legado",
    conflict: "Conflito",
    unauthorized: "Não autenticado",
    forbidden: "Proibido",
    not_found: "Não encontrado",
    error: "Erro",
  };

  const Icon = icons[status];

  return (
    <div className={cn("flex items-center gap-2", className)} role="status">
      {Icon && <Icon className={cn("h-4 w-4", status === "loading" && "animate-spin")} aria-hidden="true" />}
      <span className="text-sm text-muted-foreground">{labels[status]}</span>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

interface LoadingStateProps {
  /** Custom message */
  message?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Loading state UI.
 * Shows a skeleton or spinner appropriate for the context.
 */
export function LoadingState({
  message = "Carregando...",
  size = "md",
  className,
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  };

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-12", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn("animate-spin text-muted-foreground", sizeClasses[size])} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  /** What was being queried */
  title: string;
  /** Additional description */
  description?: string;
  /** Action to take if applicable */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Empty state UI.
 * Shows when a valid query returned no results.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}
      role="status"
    >
      <div className="rounded-full bg-muted p-4">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  /** Error code */
  code?: string;
  /** Error message */
  message: string;
  /** Technical details (for support/debugging) */
  technicalDetails?: string;
  /** Whether retry is available */
  retryable?: boolean;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  className?: string;
}

/**
 * Error state UI.
 * Shows when an unrecoverable error occurred.
 */
export function ErrorState({
  code,
  message,
  technicalDetails,
  retryable = true,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}
      role="alert"
    >
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-medium text-destructive">Erro ao carregar</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {code && (
          <p className="mt-1 text-xs text-muted-foreground">Código: {code}</p>
        )}
      </div>
      {retryable && onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      )}
      {technicalDetails && process.env.NODE_ENV === "development" && (
        <details className="mt-4 max-w-md text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Detalhes técnicos
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-xs">
            {technicalDetails}
          </pre>
        </details>
      )}
    </div>
  );
}

// ============================================================================
// Unauthorized State
// ============================================================================

interface UnauthorizedStateProps {
  message?: string;
  className?: string;
}

/**
 * Unauthorized state UI.
 * Shows when the user is not authenticated.
 */
export function UnauthorizedState({
  message = "Faça login para continuar",
  className,
}: UnauthorizedStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}
      role="alert"
    >
      <div className="rounded-full bg-muted p-4">
        <Ban className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-medium">Acesso não autorizado</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Forbidden State
// ============================================================================

interface ForbiddenStateProps {
  requiredCapability?: string;
  message?: string;
  className?: string;
}

/**
 * Forbidden state UI.
 * Shows when the user is authenticated but lacks permission.
 */
export function ForbiddenState({
  requiredCapability,
  message = "Você não tem permissão para acessar esta área",
  className,
}: ForbiddenStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}
      role="alert"
    >
      <div className="rounded-full bg-muted p-4">
        <Ban className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-medium">Acesso proibido</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {requiredCapability && (
          <p className="mt-1 text-xs text-muted-foreground">
            Capacidade requerida: {requiredCapability}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Not Found State
// ============================================================================

interface NotFoundStateProps {
  entityType?: string;
  entityId?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Not Found state UI.
 * Shows when a specific entity does not exist or is not accessible.
 */
export function NotFoundState({
  entityType = "Item",
  entityId,
  message,
  action,
  className,
}: NotFoundStateProps) {
  const defaultMessage = entityId
    ? `${entityType} "${entityId}" não foi encontrado`
    : `${entityType} não foi encontrado`;

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}
      role="alert"
    >
      <div className="rounded-full bg-muted p-4">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-medium">Não encontrado</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message ?? defaultMessage}</p>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ============================================================================
// Stale State
// ============================================================================

interface StaleStateProps {
  /** The stale data being displayed */
  children: React.ReactNode;
  /** When the data was computed */
  computedAt: Date;
  /** Data age in milliseconds */
  ageMs: number;
  /** Maximum acceptable age */
  maxAgeMs: number;
  /** Callback to refresh */
  onRefresh?: () => void;
  className?: string;
}

/**
 * Stale state wrapper.
 * Wraps content with a stale indicator when data is outdated.
 */
export function StaleState({
  children,
  computedAt,
  ageMs,
  maxAgeMs,
  onRefresh,
  className,
}: StaleStateProps) {
  const ageMinutes = Math.floor(ageMs / 60000);
  const maxAgeMinutes = Math.floor(maxAgeMs / 60000);

  return (
    <div className={className}>
      <div
        className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        role="status"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span>
          Dados desatualizados. Atualizado há {ageMinutes} minutos (máximo: {maxAgeMinutes} min).
        </span>
        <span className="ml-auto text-xs opacity-75">
          {computedAt.toLocaleTimeString("pt-BR")}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="ml-2 underline hover:no-underline"
          >
            Atualizar
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Partial State
// ============================================================================

interface PartialStateProps {
  /** The partial data available */
  partialData?: React.ReactNode;
  /** List of failed sources */
  failedSources: string[];
  /** Callback to retry */
  onRetry?: () => void;
  className?: string;
  /** Child content */
  children?: React.ReactNode;
}

/**
 * Partial state UI.
 * Shows when some sources failed to load.
 */
export function PartialState({
  partialData,
  failedSources,
  onRetry,
  className,
  children,
}: PartialStateProps) {
  return (
    <div className={className}>
      <div
        className="mb-4 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900"
        role="status"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span>
          Alguns dados não puderam ser carregados: {failedSources.join(", ")}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-2 underline hover:no-underline"
          >
            Tentar novamente
          </button>
        )}
      </div>
      {partialData ?? children}
    </div>
  );
}

// ============================================================================
// Conflict State
// ============================================================================

interface ConflictStateProps {
  /** Description of the conflict */
  conflictDescription: string;
  /** Data from first source */
  data1?: unknown;
  /** Data from second source */
  data2?: unknown;
  /** Resolution options */
  resolutionOptions?: string[];
  className?: string;
}

/**
 * Conflict state UI.
 * Shows when multiple sources are incompatible.
 */
export function ConflictState({
  conflictDescription,
  data1,
  data2,
  resolutionOptions,
  className,
}: ConflictStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4 py-12", className)}
      role="alert"
    >
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="text-center">
        <h3 className="font-medium text-destructive">Conflito de dados</h3>
        <p className="mt-1 text-sm text-muted-foreground">{conflictDescription}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Este conflito impede ação segura. Entre em contato com o suporte.
      </p>
      {resolutionOptions && resolutionOptions.length > 0 && (
        <div className="mt-2 text-sm">
          <span className="text-muted-foreground">Opções de resolução: </span>
          {resolutionOptions.join(", ")}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Legacy State
// ============================================================================

interface LegacyStateProps {
  /** The legacy data being displayed */
  children: React.ReactNode;
  /** Name of the legacy source */
  source: string;
  /** Explanation of the legacy data */
  explanation?: string;
  className?: string;
}

/**
 * Legacy state wrapper.
 * Wraps content with a legacy indicator.
 */
export function LegacyState({
  children,
  source,
  explanation = "Este registro foi criado antes da adoção do contrato canônico Health v1.",
  className,
}: LegacyStateProps) {
  return (
    <div className={className}>
      <div
        className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
        role="note"
      >
        <FileQuestion className="h-4 w-4" aria-hidden="true" />
        <span>
          <strong>Registro legado</strong> — {explanation}
        </span>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Health Technical State
// ============================================================================

interface HealthTechnicalStateProps {
  state: ReadState;
  children: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}

/**
 * Unified component that renders the appropriate UI based on read state.
 * Use this as a switch component for read states.
 */
export function HealthTechnicalState({
  state,
  children,
  onRetry,
  className,
}: HealthTechnicalStateProps) {
  switch (state.status) {
    case "idle":
    case "loading":
      return <LoadingState className={className} />;

    case "refreshing":
      return (
        <div className={className}>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Atualizando...</span>
          </div>
          {children}
        </div>
      );

    case "success":
      return <div className={className}>{children}</div>;

    case "empty":
      return (
        <EmptyState
          title="Nenhum registro encontrado"
          description={state.query}
          className={className}
        />
      );

    case "partial":
      return (
        <PartialState
          failedSources={state.failedSources}
          onRetry={onRetry}
          className={className}
        >
          {children}
        </PartialState>
      );

    case "degraded":
      return (
        <div className={className}>
          <div className="mb-4 flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
            <AlertTriangle className="h-4 w-4" />
            <span>{state.reason}</span>
          </div>
          {children}
        </div>
      );

    case "stale":
      return (
        <StaleState
          computedAt={state.computedAt}
          ageMs={state.ageMs}
          maxAgeMs={state.maxAgeMs}
          onRefresh={onRetry}
          className={className}
        >
          {children}
        </StaleState>
      );

    case "legacy":
      return (
        <LegacyState
          source={state.source}
          explanation={state.explanation}
          className={className}
        >
          {children}
        </LegacyState>
      );

    case "conflict":
      return (
        <ConflictState
          conflictDescription={state.conflictDescription}
          data1={state.data1}
          data2={state.data2}
          resolutionOptions={state.resolutionOptions}
          className={className}
        />
      );

    case "unauthorized":
      return (
        <UnauthorizedState
          message="Faça login para acessar dados de saúde"
          className={className}
        />
      );

    case "forbidden":
      return (
        <ForbiddenState
          requiredCapability={(state as ReadStateForbidden).requiredCapability}
          message={(state as ReadStateForbidden).message}
          className={className}
        />
      );

    case "not_found":
      return (
        <NotFoundState
          entityType={(state as ReadStateNotFound).entityType}
          entityId={(state as ReadStateNotFound).entityId}
          className={className}
        />
      );

    case "error":
      return (
        <ErrorState
          code={(state as ReadStateError).code}
          message={(state as ReadStateError).message}
          technicalDetails={(state as ReadStateError).technicalDetails}
          retryable={(state as ReadStateError).retryable}
          onRetry={onRetry}
          className={className}
        />
      );

    default:
      return <div className={className}>{children}</div>;
  }
}
