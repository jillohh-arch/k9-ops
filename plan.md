# Plano — Refatoração do card "Equipe de Serviço"

## Resumo

Refatorar o `EquipeCard` existente em `dashboard-service-day-cards.tsx` para virar um card completo de "Viatura em Serviço / Guarnição Embarcada", mantendo o mesmo tamanho aproximado (~320px min-height) e a mesma identidade visual dark navy/glassmorphism do dashboard.

## Análise do código atual

- **`EquipeCard`** em `src/features/dashboard/components/dashboard-service-day-cards.tsx` (linhas 212-304) — card simples com badge da viatura, lista de MemberChips e bloco K9 básico
- **`ServiceDayCrew`** em `dashboard-types.ts` — já possui: `vehicleLabel`, `vehiclePrefix`, `vehicleModel`, `vehicleUnit`, `members[]`, `dog?`
- **`ServiceDogMember`** — possui: `id`, `name`, `photoUrl?`, `specializations[]`
- **`useCrewPayload`** em `hooks/use-service-day-data.ts` — resolve tudo a partir do Firestore em tempo real
- **`useCrewMembers`** — listener real-time da sub-coleção `vehicle_crews/{id}/members`
- Background image já existe: `public/assets/card_equipe.png`
- Ícone do módulo: `public/assets/icones/equipe_servico.png`

## Arquivos que serão alterados

| # | Arquivo | O que muda |
|---|---------|------------|
| 1 | `src/features/dashboard/components/dashboard-types.ts` | Estender `ServiceDogMember` com `breed?`, `status?`, `handlerCallsign?`; estender `ServiceDayCrew` com `shiftStart?`, `shiftEnd?` |
| 2 | `src/features/dashboard/hooks/use-service-day-data.ts` | Extrair breed/status/handler do dog record e shift times do crew record no Firestore |
| 3 | `src/features/dashboard/components/dashboard-service-day-cards.tsx` | Reescrever o `EquipeCard` inteiro com novo layout (o `PlantaoCard` fica INTOCADO) |

## Novo layout do EquipeCard

```
┌──────────────────────────────────────────────────────────────┐
│ [icon] EQUIPE DE SERVIÇO               ● ONLINE             │
│        Guarnição embarcada na viatura operacional.            │
│                                                              │
│  ● CANIL 1075 • EM SERVIÇO                                  │
│                                                              │
│ ┌─ VIATURA EM SERVIÇO ──────────────────────────────────┐   │
│ │ CANIL 1075  ·  Toyota Hilux                            │   │
│ │ 📍 Limeira/SP      ⏰ 07h00 – 19h00                   │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ── GUARNIÇÃO EMBARCADA ──          ┌── K9 OPERACIONAL ──┐   │
│ ┌────────┐ ┌────────┐             │ [🐕]  Bono         │   │
│ │ [Av]   │ │ [Av]   │             │ K9 · Malinois      │   │
│ │Ragonha │ │ Silva  │             │ Binômio op.        │   │
│ │RA xxxxx│ │RA xxxxx│             │ com Ragonha        │   │
│ │ ENC    │ │ MOT    │             │ PRONTO P/ EMPREGO  │   │
│ └────────┘ └────────┘             └─────────────────────┘   │
│ ┌────────┐ ┌────────┐                                       │
│ │ [Av]   │ │ [Av]   │   ← imagem de fundo (opacidade baixa)│
│ │Membro 3│ │Membro 4│                                       │
│ │RA xxxxx│ │RA xxxxx│                                       │
│ │ AUX1   │ │ AUX2   │                                       │
│ └────────┘ └────────┘                                       │
└──────────────────────────────────────────────────────────────┘
```

## Subcomponentes internos (todos no mesmo arquivo)

1. **`VehicleInfoBanner`** — faixa compacta com nome/modelo/local/turno da viatura. Borda cyan sutil, ícones inline (MapPin, Clock)
2. **`CrewMemberMiniCard`** — card vertical compacto com avatar circular, callsign, RA e role badge. O primeiro membro (encarregado) recebe borda cyan mais forte
3. **`K9OperationalPanel`** — bloco âmbar com foto do dog, nome, raça, condutor vinculado e status operacional
4. **`EmptyServiceState`** — estado vazio compacto (já existe, vou apenas refinar visualmente)
5. **`StatusPill`** — badge reutilizável tipo "CANIL 1075 • EM SERVIÇO" com dot pulsante

## Fonte de dados

- **Todos** os dados vêm do `useCrewPayload` existente — nenhuma nova API, rota ou fetch
- O condutor/handler do K9 = primeiro membro da lista (titular, já ordenado pelo hook)
- Raça do dog: extrair do campo `breed` / `raca` / `race` no Firestore (fallback: primeira especialização ou string vazia)
- Status do dog: extrair do campo `status` / `operational_status` (fallback: "Pronto para emprego" se o dog existe no crew)
- Turno: extrair de `shift_start`/`shift_end` no crew doc (fallback: não mostrar a linha de turno)

## Regras visuais

- Dark navy glassmorphism: `bg-[#0b1628]/82`, `border-cyan-200/12`
- Background image `card_equipe.png` com gradient overlay (esquerda opaca, direita transparente)
- Badges de status: verde/emerald para "em serviço"
- K9 panel: borda `amber-400/25`, bg `amber-500/5`
- Primeiro membro: borda `cyan-400/30` mais forte que os demais
- Role badges: `text-[9px]` uppercase tracking-wider
- Dot "ONLINE": `HudStatusDot` emerald no canto superior direito
- Responsivo:
  - **Desktop**: guarnição (grid 2 colunas) e K9 lado a lado
  - **Tablet/Mobile**: empilhado — viatura → guarnição → K9

## Estado vazio (quando não há crew ativa)

Mantém o visual existente com pequeno refinamento:
- Ícone ShieldCheck discreto
- Texto: "Nenhuma equipe em serviço"
- Subtexto: "Não há viatura com guarnição ativa no momento."
- Background image mantida com opacidade baixa

## O que NÃO será tocado

- `PlantaoCard` — zero alterações
- API / rotas / autenticação
- Layout global do dashboard
- Outros cards (Métricas, Ocorrências, Pendências, Saúde, Drogas)
- Firebase Rules

## Verificação

- Rodar `npm run build` após implementação
- Corrigir qualquer erro de tipo ou lint
- Confirmar que todos os subcomponentes usam dados reais do hook (sem mock permanente)
