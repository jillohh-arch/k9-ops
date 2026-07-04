# Sessão 2026-07-04 — Equipe de Serviço no Painel Web

## Contexto

Painel web (`k9-ops`) não estava mostrando os membros da guarnição no card
"Equipe de serviço". O modelo do mobile foi atualizado na sessão anterior
(2026-07-03) para gravar membros em sub-coleção `vehicle_crews/{crewId}/members`,
mas o painel web ainda tentava reconstruir membros de `active_shifts`.

## Investigação

### Modelo atual no Firestore (do mobile)

- `vehicle_crews/{crewId}`: documento pai com `active`, `service_dog_id`, `titular_handler_id`
- `vehicle_crews/{crewId}/members/{handlerId}`: sub-coleção com `role` (motorista/encarregado/auxiliar_1/auxiliar_2), `status`, `dog_id`, `name`
- `active_shifts/{handlerId}`: cada handler tem doc com `vehicle_id`, `crew_role`, `service_dog_id`

### Problema no painel web

1. Não assinava `vehicle_crews/{crewId}/members` — recebia update do doc pai mas não dos membros
2. Tentava reconstruir membros filtrando `active_shifts` por `vehicle_id` — perdia dados (role, dog_id por handler)
3. `isActiveVehicleCrew` rejeitava crews com `active: true` se houvesse `ended_at` antigo (resíduo de ciclo)

## Correções aplicadas

### 1. `src/features/dashboard/types.ts` — novo tipo

Adicionado `VehicleCrewMember` interface com campos do Firestore:
- `handler_id`, `name`, `role`, `status`, `dog_id`, `joined_at`, `responded_at`, `left_at`

### 2. `src/features/dashboard/hooks/use-crew-members.ts` (NOVO)

Hook que assina `vehicle_crews/{crewId}/members` para cada crew ativa.
- Gerencia subscriptions dinâmicas via `useRef<Map<string, Unsubscribe>>`
- Cancela subscriptions de crews que ficaram inativas
- Cleanup final no unmount
- Query: `where("status", "==", "active")`

### 3. `src/features/dashboard/hooks/use-service-day-data.ts` — refatoração

`useCrewPayload` refatorado:
- Aceita `crewMembers: Record<string, DashboardRecord[]>` como novo parâmetro
- Prioriza sub-coleção `members` como source-of-truth
- Fallback para `active_shifts` (dados legados sem sub-coleção)
- Role mapping: `motorista` → `MOT`, `encarregado` → `ENC`, `auxiliar_1` → `AUX1`, `auxiliar_2` → `AUX2`

### 4. `src/app/(app)/dashboard/page.tsx`

- Importado `useCrewMembers`
- Chamado: `useCrewMembers(dashboardCollections.vehicleCrews.records)`
- Passado para `useCrewPayload` como `crewMembers`

### 5. `src/features/dashboard/components/dashboard-utils.ts` — `isActiveVehicleCrew`

Removida verificação de `ended_at` que rejeitava crews com `active: true` mas
`ended_at` antigo (resíduo de ciclo anterior). Aceita cycle reaberto:

```ts
if (parseBoolean(record.active) === true) {
  return true;
}
return false;
```

### 6. `src/features/dashboard/components/dashboard-service-day-cards.tsx`

- `MemberChip` agora aceita `role?` opcional e mostra badge cyan compacto (MOT/ENC/AUX1/AUX2)
- `EquipeCard` substituiu `CrewMemberRow` por `MemberChip` em grid de 2 colunas
- Visual alinha com `PlantãoCard` (mesmo estilo de chip)

## Validação

- `npm run build`: ✓ Compiled successfully
- Dashboard mostra:
  - Vehicle badge "Canil 1075 - Em serviço"
  - Vehicle info (modelo + unidade)
  - Grid 2 colunas com membros
  - Badge INSTRUTOR K9 + role badge (ENC, MOT, etc.)
  - Card K9 (Bono) abaixo dos membros
- Updates em tempo real: novos membros aparecem quando aderem à guarnição no mobile

## Arquivos modificados

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `src/features/dashboard/components/dashboard-types.ts` | Adicionado `VehicleCrewMember` |
| 2 | `src/features/dashboard/hooks/use-crew-members.ts` | NOVO — hook de subscription |
| 3 | `src/features/dashboard/hooks/use-service-day-data.ts` | `useCrewPayload` refatorado |
| 4 | `src/app/(app)/dashboard/page.tsx` | Wire-up do `useCrewMembers` |
| 5 | `src/features/dashboard/components/dashboard-utils.ts` | `isActiveVehicleCrew` ajustado |
| 6 | `src/features/dashboard/components/dashboard-service-day-cards.tsx` | `MemberChip` com role badge, `EquipeCard` usa chip |

## Lições aprendidas

1. Quando o mobile migra de modelo flat para sub-coleções, o painel precisa assinar a sub-coleção — não pode continuar inferindo
2. `isActiveVehicleCrew` precisa tolerar `ended_at` antigo em crews reabertas (campo persiste entre ciclos)
3. Ao reusar componente de Plantão para Equipe, basta passar o role via prop opcional
