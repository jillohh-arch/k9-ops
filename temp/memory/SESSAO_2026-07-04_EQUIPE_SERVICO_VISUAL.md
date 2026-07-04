# Sessão 2026-07-04 — Refatoração Visual: Card "Equipe de Serviço"

**Data:** 04/07/2026  
**Branch:** master  
**Commits da sessão:**
- `3b70c24` — feat(dashboard): equipe de serviço card com crew members em tempo real *(sessão anterior)*
- Este commit — feat(dashboard): refatoração visual completa do card Equipe de Serviço

---

## Contexto

O card "Equipe de Serviço" aparecia vazio porque o operador ainda não havia assumido turno no mobile — **não era bug de dados**. Com turno ativo, os dados já chegavam corretos via `useCrewPayload` + `useCrewMembers`.

O objetivo desta sessão foi **apenas refatoração visual** do card, deixando a lógica de dados intacta.

---

## O que foi feito

### 1. `src/features/dashboard/components/dashboard-types.ts`
- Estendeu `ServiceDogMember` com campos opcionais:
  - `breed?: string` — raça do cão (ex: "Pastor Belga Malinois")
  - `status?: string` — status operacional (ex: "Pronto para emprego")
- Estendeu `ServiceDayCrew` com:
  - `shiftStart?: string` — hora início do turno
  - `shiftEnd?: string` — hora fim do turno

### 2. `src/features/dashboard/hooks/use-service-day-data.ts`
- `useCrewPayload` passou a extrair do Firestore:
  - `dog.breed` — campos `breed`, `raca`, `race`
  - `dog.status` — campos `operational_status`, `status`, `readiness`; fallback: `"Pronto para emprego"`
  - `shiftStart` — campos `shift_start`, `shiftStart`, `start_time`
  - `shiftEnd` — campos `shift_end`, `shiftEnd`, `end_time`

### 3. `src/features/dashboard/components/dashboard-service-day-cards.tsx`
Refatoração visual completa do `EquipeCard`. Novos subcomponentes internos:

| Subcomponente | Descrição |
|---|---|
| `VehicleInfoBanner` | Faixa compacta com nome/modelo/local/turno da viatura |
| `CrewMemberMiniCard` | Card vertical com avatar, callsign, RA, role badge |
| `K9OperationalPanel` | Bloco âmbar com foto, nome, breed, condutor vinculado, status |

#### Layout novo do card quando há equipe ativa:
```
┌──────────────────────────────────────────────────────┐
│ [icon] EQUIPE DE SERVIÇO               ● ONLINE      │
│        Guarnição embarcada na viatura.                │
│                                                      │
│  ● CANIL 1075 • EM SERVIÇO                          │
│                                                      │
│ ┌─ VIATURA EM SERVIÇO ──────────────────────────┐   │
│ │ CANIL 1075  ·  Toyota Hilux                    │   │
│ │ 📍 Limeira/SP      ⏰ 07h00 – 19h00           │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── GUARNIÇÃO ──        ┌── K9 OPERACIONAL ──────┐   │
│ ┌──────┐ ┌──────┐      │ [🐕]  Bono             │   │
│ │[Av]  │ │[Av]  │      │ K9 · Malinois          │   │
│ │Ragonha│ │Silva │      │ Binômio · com Ragonha  │   │
│ │ ENC  │ │ MOT  │      │ PRONTO PARA EMPREGO    │   │
│ └──────┘ └──────┘      └────────────────────────┘   │
│ ┌──────┐ ┌──────┐                                   │
│ │[Av]  │ │[Av]  │    ← bg image (low opacity)       │
│ │Mem 3 │ │Mem 4 │                                   │
│ │ AUX1 │ │ AUX2 │                                   │
│ └──────┘ └──────┘                                   │
└──────────────────────────────────────────────────────┘
```

#### Regras visuais aplicadas:
- Dark navy glassmorphism: `bg-[#0b1628]/82`, `border-cyan-200/12`
- Background image `card_equipe.png` + gradient overlay preservados
- Badge status: emerald `● CANIL 1075 • EM SERVIÇO`
- Dot `ONLINE` (HudStatusDot emerald) no canto superior direito
- Primeiro membro: borda cyan mais forte `border-cyan-400/40` para destaque
- Role badges: `text-[9px]` uppercase, bordas cyan/violet conforme função
- K9 panel: `border-amber-400/25`, `bg-amber-500/5`
- Condutor K9 vinculado ao primeiro membro da lista (titular)
- Responsivo: desktop flex row (guarnição + K9 lado a lado); mobile stacked

#### Estado vazio: inalterado
- Ícone + "Nenhuma equipe em serviço" + subtexto

### 4. Ícones adicionados em `public/assets/icones/`
- `equipe_servico.png`
- `header_ocorrencias.png`
- `header_pendencias.png`
- `pend_acoes.png`
- `pend_assinaturas.png`
- `pend_evolucoes.png`
- `pend_finalizacao.png`

### 5. Novos componentes criados nas sessões anteriores
- `src/features/dashboard/components/occurrence-sparkline.tsx`
- `src/features/dashboard/components/png-icon.tsx`

---

## O que NÃO foi alterado
- Hooks de dados (`useCrewPayload`, `useCrewMembers`, `useShiftPayload`)
- Firebase/Firestore subscriptions
- Rotas, autenticação, layout global
- `PlantaoCard` (card ao lado)
- `dashboard-types.ts` além dos campos opcionais adicionados

---

## Deploy
- `firebase deploy --only hosting` via CLI (não toca em rules)
- Não rodar `firebase deploy` sem o `--only hosting` para evitar sobrescrever security rules antigas

---

## Observações técnicas
- `useCrewMembers` assina `vehicle_crews/{crewId}/members` em tempo real
- Membros aparecem automaticamente quando handler assume turno no mobile
- `isActiveVehicleCrew` verifica apenas `active === true`, sem checar `ended_at`
- Dog conduzido: vinculado ao `titular_handler_id` ou primeiro da lista
