# Plano — Redesign Equipe de Serviço + Histórico de Guarnições

## Entregas

1. **Redesign visual do EquipeCard** — painel operacional rico estilo HUD tático
2. **Página de Histórico de Guarnições** — rota `/shifts/history`
3. **Conferência de rules** — apenas verificar leitura de `vehicle_crew_history`

---

## ENTREGA 1 — Redesign do EquipeCard

### Dados disponíveis hoje (sem criar listeners novos)

O `useCrewPayload` já retorna:
- `vehicleLabel`, `vehiclePrefix`, `vehicleModel`, `vehicleUnit`
- `members: Array<ServiceDayMember & { role: string }>` — role já mapeado (MOT/ENC/AUX1/AUX2)
- `dog?: ServiceDogMember` (name, photoUrl, specializations, breed?, status?)
- `shiftStart?`, `shiftEnd?`

O que **não** existe no payload hoje:
- `shiftGroupLabel` — o crew doc não tem esse campo; vou ignorar (mostrar "Turno atual" genérico)
- `created_at` da crew — não extraído; vou adicionar extração simples como `createdAt?: string`
- `dog_id` por membro — existe no Firestore (`VehicleCrewMember.dog_id`) mas não é propagado. Vou propagar para identificar o condutor K9.
- `updated_at` — não extraído; vou adicionar para o rodapé

### Mudanças no hook (`use-service-day-data.ts`)

Mínimas, sem listener novo:
1. Extrair `created_at` / `createdAt` do crew doc → expor como `createdAt?: string`
2. Extrair `updated_at` / `updatedAt` do crew doc → expor como `updatedAt?: string`
3. Ao mapear membros da sub-coleção, ler `dog_id` de cada membro → expor em `ServiceDayMember` como `dogId?: string`

### Mudanças em `dashboard-types.ts`

- `ServiceDayMember`: adicionar `dogId?: string`
- `ServiceDayCrew`: adicionar `createdAt?: string`, `updatedAt?: string`

### Novo layout do EquipeCard

Reescrever o `EquipeCard` completamente:

```
┌─────────────────────────────────────────────────────────────────┐
│ [icon] EQUIPE DE SERVIÇO    [OPERACIONAL●] / [INCOMPLETA●]  ●ON│
│        Guarnição embarcada na viatura operacional.               │
│                                                                 │
│  ● CANIL 1075 • EM SERVIÇO                                     │
│                                                                 │
│ ┌── VIATURA EM SERVIÇO ────────────────────────────────────┐    │
│ │ CANIL 1075         Toyota Hilux                          │    │
│ │ 📍 Limeira/SP      ⏰ Turno: 07h00 – 19h00              │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                 │
│ ── GUARNIÇÃO EMBARCADA ───────────────────────────────────────  │
│                                                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │  [Av]    │ │  [Av]    │ │  [Av]    │ │  [Av]    │           │
│ │ Ragonha  │ │ Silva    │ │ ─ ─ ─ ─  │ │ ─ ─ ─ ─  │           │
│ │ RA xxxxx │ │ RA xxxxx │ │POSTO VAGO│ │POSTO VAGO│           │
│ │  ENC     │ │  MOT     │ │  AUX1    │ │  AUX2    │           │
│ │CONDUTOR  │ │          │ │          │ │          │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
│ ┌── K9 OPERACIONAL (âmbar/dourado) ────────────────────────┐   │
│ │ [🐕 foto]  Bono  ·  Pastor Belga Malinois               │   │
│ │ Binômio operacional com Ragonha                          │   │
│ │ STATUS: PRONTO PARA EMPREGO                              │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ─── DATA: 04/07/2026 │ ATUALIZ.: 08:42 │ PATRULHAMENTO ─────  │
└─────────────────────────────────────────────────────────────────┘
```

#### Regras de derivação:

- **OPERACIONAL**: tem pelo menos 1 membro com role `encarregado`/`ENC` + 1 com role `motorista`/`MOT` (ambos ativos)
- **INCOMPLETA**: falta encarregado ou motorista
- **4 slots fixos**: ENC, MOT, AUX1, AUX2. Membros preenchem pelo role. Slots sem membro = "POSTO VAGO" (dashed, esmaecido)
- **Condutor K9**: membro cujo `dogId` está preenchido → badge extra "CONDUTOR K9" (cyan)
- **Legado** (role "titular" ou vazio/"Integrante"): aparece após os 4 slots como "Função não informada"
- **K9 sem cão**: bloco dourado esmaecido "SEM K9 EMBARCADO"
- **Condutor vinculado ao K9**: nome do membro que tem `dogId` == `crew.dog.id`

#### Subcomponentes internos (mesmo arquivo):

1. `CrewSlotCard` — slot de posto (ocupado ou vago)
2. `K9OperationalPanel` — painel âmbar do cão
3. `VehicleBanner` — faixa da viatura
4. `CrewFooter` — rodapé com metadados
5. `StatusChip` — OPERACIONAL/INCOMPLETA

#### Layout/grid do dashboard:

Manter o grid `xl:grid-cols-2` inalterado. O EquipeCard simplesmente cresce em altura (auto). Não quebra vizinhos.

#### Motion:

- Card: `hudEntry` (já tem via motion.div wrapper no page.tsx)
- Slots da guarnição: stagger interno 60ms via `transition-delay` CSS inline
- HudStatusDot: pulso apenas no chip OPERACIONAL

---

## ENTREGA 2 — Histórico de Guarnições

### Rota

`/shifts/history` → `src/app/(app)/shifts/history/page.tsx`

Acessível a partir da página de Plantões (`/shifts`) via botão/link.

### Estrutura da página

```
┌─────────────────────────────────────────────┐
│ [←] Histórico de Guarnições                 │
│                                             │
│ Filtros: [Viatura ▾] [Data início] [Data fim]│
│                                             │
│ ┌─ Card ──────────────────────────────────┐ │
│ │ Canil 1075 · 03/07/2026                 │ │
│ │ 07:00 – 19:00 (12h)                    │ │
│ │ Ragonha (ENC) · Silva (MOT) · K9 Bono  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Carregar mais]                             │
└─────────────────────────────────────────────┘
```

### Dados

- Coleção: `vehicle_crew_history`
- Query: `getDocs` (NÃO onSnapshot — dado imutável, economiza reads)
- Ordenação: `period.ended_at` desc
- Paginação: `limit(20)` + `startAfter(lastDoc)`
- Filtros:
  - Por viatura: `where("vehicle_id", "==", selectedVehicleId)`
  - Por data: `where("period.started_at", ">=", startDate)` + `where("period.started_at", "<=", endDate)`

### Índice composto

A query `vehicle_id + period.ended_at desc` provavelmente exige índice composto. Se o Firestore retornar erro com link de criação, vou **reportar o link** para o usuário clicar — NÃO criar via CLI.

### Componentes

- `CrewHistoryPage` — page component com filtros + lista + paginação
- `CrewHistoryCard` — card compacto de cada guarnição passada
- `CrewHistoryFilters` — select de viatura + date pickers

### Hook

- `useCrewHistory` — hook com `getDocs`, paginação cursor-based, filtros. Zero `onSnapshot`.

---

## ENTREGA 3 — Conferência de Rules

Apenas verificar se `vehicle_crew_history` tem `allow read: if signedIn()` nas rules. Reportar resultado. NÃO editar rules.

---

## Arquivos a criar/modificar

| # | Arquivo | Ação |
|---|---------|------|
| 1 | `src/features/dashboard/components/dashboard-types.ts` | Adicionar `dogId?` em ServiceDayMember, `createdAt?`/`updatedAt?` em ServiceDayCrew |
| 2 | `src/features/dashboard/hooks/use-service-day-data.ts` | Extrair `created_at`, `updated_at`, `dog_id` por membro |
| 3 | `src/features/dashboard/components/dashboard-service-day-cards.tsx` | Reescrever EquipeCard inteiro com novo layout HUD |
| 4 | `src/lib/routes/paths.ts` | Adicionar `shiftsHistory` |
| 5 | `src/app/(app)/shifts/history/page.tsx` | Nova página de histórico |
| 6 | `src/features/shifts/hooks/use-crew-history.ts` | Hook getDocs paginado |
| 7 | `src/app/(app)/shifts/page.tsx` | Link para /shifts/history |

---

## Validação

1. `npm run build` + typecheck limpos
2. Zero listeners novos no dashboard (Entrega 1)
3. Zero `onSnapshot` no histórico — só `getDocs` (Entrega 2)
4. Descrever estado com 1 membro (ENC condutor K9 + 3 postos vagos + Bono)
5. Se Firestore negar leitura de `vehicle_crew_history`, reportar — NÃO editar rules
6. Se índice composto for necessário, reportar link — NÃO criar via CLI
7. Listar todos os arquivos criados/modificados
