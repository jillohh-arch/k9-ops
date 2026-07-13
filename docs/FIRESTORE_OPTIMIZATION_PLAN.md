# Plano de Otimização do Firestore — K9 Ops

> Baseado na auditoria em `docs/FIRESTORE_SCHEMA.md`
> Data: 2026-07-10
> Repositório: `k9-ops`
> Firebase: `canil-gcm`

---

## Sumário

| Fase | Tarefas | Descrição |
|------|---------|-----------|
| **Fase 0** | 15 | Baseline e observabilidade |
| **Fase 1** | 19 | Ganho seguro sem mudança de schema |
| **Fase 2** | 8 | Relatórios e agregações |
| **Fase 3** | 6 | N+1 e arquitetura de leitura |
| **Fase 4** | 5 | Padronização e migrações futuras |
| **Total** | **38** | 38 tarefas `#### OPT-FS-*` |

---

## Validações Manuais Necessárias Antes de Começar

### Confirmações Críticas

| # | Item | Como Validar | Status |
|---|------|--------------|--------|
| 1 | 37 Functions são exports implantáveis | Verificar `firebase.json` e deployment | **Requer validação** |
| 2 | 70 coleções: separar raiz vs subcoleções | Contagem manual no Firestore Console | **Requer validação** |
| 3 | 16 getDocs() crescem indefinidamente | Verificar volume real no Firebase Console | **Requer validação** |
| 4 | Listeners se sobrepõem | Análise de código: EntitiesProvider vs dashboard | **Confirmado** |
| 5 | Consultas `users` e `dogs` compartilhadas | EntitiesProvider: 3 listeners compartilhados | **Confirmado** |
| 6 | Todos listeners possuem unsubscribe | 18 arquivos com cleanup | **Confirmado** |
| 7 | Consultas relatório exigem completude | Análise de cada relatório | **Confirmado parcialmente** |
| 8 | `docs/` está untracked | `git status` | **Confirmado** |

### Firebase Console — Ações Requeridas

| # | Ação | Local | Prioridade |
|---|------|-------|------------|
| 1 | Confirmar plano (Spark/Blaze/Flame) | Billing > Plan | 🔴 Alta |
| 2 | Confirmar Firestore Edition (Standard/Enterprise) | Settings > Firestore | 🔴 Alta |
| 3 | Configurar budget alerts | GCP > Billing > Budgets | 🔴 Alta |
| 4 | Exportar métricas de uso (leitura/escrita/dia) | Usage > Export | 🟠 Média |
| 5 | Contar documentos por coleção | Firestore > Data | 🟠 Média |
| 6 | Verificar índices em uso vs não usados | Indexes > Performance | 🟡 Baixa |

---

## Fase 0 — Baseline e Observabilidade

**Objetivo:** Estabelecer linha de base para comparar antes e depois de cada otimização.

### Instrumentação no Código (Não Implementar, Apenas Documentar)

| # | Métrica | Como Instrumentar | Arquivo |
|---|---------|------------------|---------|
| F0-001 | Leituras por operação | Logging em cada `getDocs()`, `getDoc()` | — |
| F0-002 | Documentos por snapshot | `snapshot.size` em cada `onSnapshot` | — |
| F0-003 | Tempo de resposta | `performance.now()` entre query e render | — |
| F0-004 | Listeners simultâneos | Counter global de subscriptions | — |
| F0-005 | Reconexões | Network status listener | — |

### Firebase Console — Métricas a Registrar

| # | Métrica | Onde Encontrar | Frequência |
|---|---------|----------------|------------|
| F0-006 | Leituras por dia | Usage > Reads | Diário por 7 dias |
| F0-007 | Escritas por dia | Usage > Writes | Diário por 7 dias |
| F0-008 | Exclusões por dia | Usage > Deletes | Diário por 7 dias |
| F0-009 | Armazenamento total | Usage > Storage | Semanal |
| F0-010 | Transferência de dados | Usage > Network | Semanal |
| F0-011 | Custo de Functions | GCP > Cloud Functions > Metrics | Diário |
| F0-012 | Consultas mais frequentes | Indexes > Queries | Único |

### Documentos a Criar (Linha de Base)

| # | Documento | Conteúdo | Prioridade |
|---|----------|----------|------------|
| F0-013 | `baseline_reads_YYYY-MM-DD.json` | Leituras/dia por coleção | 🔴 Alta |
| F0-014 | `baseline_documents_YYYY-MM-DD.json` | Contagem por coleção | 🔴 Alta |
| F0-015 | `baseline_listeners_screen.json` | Listeners por tela (análise de código) | 🟠 Média |

---

## Fase 1 — Ganho Seguro Sem Mudança de Schema

### Filtros por Status Ativo

#### OPT-FS-101 — Filtrar `vehicle_crews` por `active == true`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ **CONCLUÍDA** |
| **Fase** | 1 |
| **Prioridade** | P1 |
| **Confiança** | Confirmado no código + runtime |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Dashboard |

**Escopo:** Somente dashboard. Central Operacional não incluída.

**Problema:** O dashboard carrega todas as crews, incluindo inativas.

**Investigação concluída:**
- Dashboard filtra crews ativas via `isActiveVehicleCrew`
- Nenhum consumidor precisa de crews inativas no dashboard
- Campo `active` é obrigatório pelo schema

**Implementação:**

```typescript
// dashboard/page.tsx
query(collection(db, "vehicle_crews"), where("active", "==", true))
```

**Arquivos alterados:**
- `src/app/(app)/dashboard/page.tsx`

**Índice:** Query usa índice de campo único automático. Nenhum composto necessário.

**Validações realizadas:**
| Validação | Status |
|-----------|--------|
| Build/typecheck | ✅ Aprovado |
| Análise estática | ✅ Confirmado |
| Validação runtime (dashboard) | ✅ Aprovado |
| Compatibilidade documentos legados | ⏳ Pendente (Firebase Console) |

**Critérios validados:**
- [x] Crew ativa aparece no dashboard
- [x] Ao receber `active:false`, desaparece
- [x] O listener de `members` correspondente é removido
- [x] Crew reaparece ao voltar para `active:true`
- [x] Console não mostra erro de índice

**Métricas:**
| Métrica | Antes | Depois |
|---------|-------|--------|
| Documentos entregues | Todas as crews | Apenas `active == true` |
| Listeners | Inalterado | Inalterado |
| Consultas | 1 | 1 (com filtro) |

---

**📋 Central Operacional — Pendente**

> ⚠️ Contrato funcional da Central Operacional ainda não definido.
> Não alterar queries antes da definição de seus objetivos, indicadores e fluxos.

**Status:** Aguardando revisão funcional e arquitetural.

**Quando definir o contrato:**
1. Quais crews a tela deve exibir? (ativas, todas, ou critério diferente?)
2. A tela usa crews inativas para algum indicador?
3. Transições recentes ou alertas dependem do histórico de crews?
4. Comparação com `active_shifts` requer crews inativas?

**Após definição do contrato:**
- Avaliar se filtro `active == true` é aplicável
- Documentar métricas e dependências
- Validar separadamente antes de implementar

---

### Central Operacional — Revisão Funcional Pendente

> **Arquivo:** `src/features/operations/hooks/use-operational-center-data.ts`
>
> ⚠️ O contrato funcional da Central Operacional ainda não está definido.
> Não alterar queries antes da definição de seus objetivos, indicadores e fluxos.
>
> **Quando a tela for redesenhada:**
> 1. Definir objetivos e fluxos da Central Operacional
> 2. Documentar quais crews devem ser exibidas
> 3. Mapear dependências de crews inativas
> 4. Somente então otimizar as consultas


**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/app/(app)/dashboard/page.tsx`, `src/features/operations/hooks/use-operational-center-data.ts`
**Critérios de aceite:**
- [ ] Dashboard exibe mesma quantidade de crews ativas
- [ ] Nenhum erro de console
- [ ] Tempo de renderização reduzido
**Validação funcional:** Comparar contagem no Firebase Console
**Validação de custo:** `baseline_reads` vs `post_optimization_reads`
**Rollback:** Remover filtro
**Dependências:** Nenhuma

---

#### OPT-FS-102 — Filtrar `shift_groups` por `active == true`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P1 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Dashboard |

**Problema:** `useShiftGroups` carrega todos os grupos, incluindo inativos.

**Evidência:**
```typescript
// src/features/effective/hooks/use-shift-groups.ts
onSnapshot(collection(db, "shift_groups"), ...)  // Sem filtro
```

**Comportamento atual:** Retorna ~10-20 grupos totais.

**Alteração proposta:** Adicionar `where("active", "==", true)`.

**Comportamento esperado:** Retorna ~5-10 grupos ativos.

**Consultas antes:** 1
**Consultas depois:** 1
**Documentos antes:** ~20
**Documentos depois:** ~10
**Listeners antes:** 1
**Listeners depois:** 1
**Impacto em regras:** Nenhum
**Impacto em índices:** Requer índice `active` (automático existe)
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/effective/hooks/use-shift-groups.ts`
**Critérios de aceite:**
- [ ] Tela de turnos exibe mesma quantidade de grupos ativos
**Validação funcional:** Verificar grupo ausente no Firebase Console
**Rollback:** Remover filtro
**Dependências:** Nenhuma

---

#### OPT-FS-103 — Filtrar `user_shift_assignments` por `active == true`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P1 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Dashboard |

**Problema:** Carrega todas as atribuições, incluindo inativas.

**Evidência:**
```typescript
// src/features/effective/data/shift-group-service.ts
onSnapshot(collection(db, "user_shift_assignments"), ...)  // Sem filtro
```

**Comportamento atual:** Retorna todas as atribuições.

**Alteração proposta:** Adicionar `where("active", "==", true)`.

**Comportamento esperado:** Retorna apenas atribuições ativas.

**Consultas antes:** 1
**Consultas depois:** 1
**Documentos antes:** ~100+
**Documentos depois:** ~50
**Listeners antes:** 1
**Listeners depois:** 1
**Impacto em regras:** Nenhum
**Impacto em índices:** Requer índice `active + shiftGroupId` (não existe)
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/effective/data/shift-group-service.ts`
**Critérios de aceite:**
- [ ] Atribuições de turno funcionam corretamente
- [ ] Sem erros de índice
**Validação funcional:** Verificar atribuições ativas no Firebase Console
**Rollback:** Remover filtro
**Dependências:** OPT-FS-104 (índice)

---

#### OPT-FS-104 — Criar índice `user_shift_assignments: active + shiftGroupId`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P1 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Problema:** Sem índice, filtro `where("active", "==", true)` causa full scan.

**Evidência:**
```json
// firestore.indexes.json
// Não existe índice para user_shift_assignments
```

**Comportamento atual:** Full collection scan.

**Alteração proposta:** Criar índice composto `active ASC + shiftGroupId ASC`.

**Comportamento esperado:** Query usa índice.

**Consultas antes:** 1 (full scan)
**Consultas depois:** 1 (usa índice)
**Documentos antes:** Todos
**Documentos depois:** Apenas matching
**Listeners antes:** N/A
**Listeners depois:** N/A
**Impacto em regras:** Nenhum
**Impacto em índices:** Adiciona 1 índice
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `firestore.indexes.json`
**Critérios de aceite:**
- [ ] Query usa índice no Firebase Console
- [ ] Sem degradação de performance
**Validação funcional:** Verificar uso do índice
**Rollback:** Remover índice
**Dependências:** Nenhuma

---

### Filtros por Período

#### OPT-FS-105 — Filtrar `shift_logs` por período

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Confiança** | Fortemente indicado |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Problema:** Relatórios podem carregar todos os logs históricos.

**Evidência:**
```typescript
// src/features/reports/hooks/use-reports-data.ts:194
{ key: "shiftLogs", path: "shift_logs" }  // Sem filtro de período
```

**Comportamento atual:** Retorna todos os logs.

**Alteração proposta:** Adicionar filtro `where("started_at", ">=", periodStart)`.

**Comportamento esperado:** Retorna apenas logs do período selecionado.

**Consultas antes:** 1
**Consultas depois:** 1
**Documentos antes:** Ilimitados
**Documentos depois:** Período selecionado
**Listeners antes:** 0 (one-time)
**Listeners depois:** 0 (one-time)
**Impacto em regras:** Nenhum
**Impacto em índices:** Requer índice `started_at` (automático)
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/reports/hooks/use-reports-data.ts`
**Critérios de aceite:**
- [ ] Relatório de turnos exibe dados do período correto
- [ ] Sem truncation errors
**Validação funcional:** Comparar contagem com Firebase Console
**Rollback:** Remover filtro
**Dependências:** Nenhuma

---

#### OPT-FS-106 — Filtrar `vehicle_crew_history` por período

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Confiança** | Fortemente indicado |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Problema:** Histórico pode crescer indefinidamente.

**Evidência:**
```typescript
// src/features/reports/hooks/use-reports-data.ts:197
{ key: "crewHistory", path: "vehicle_crew_history" }  // Sem filtro
```

**Comportamento atual:** Retorna todo o histórico.

**Alteração proposta:** Adicionar filtro `where("created_at", ">=", periodStart)`.

**Comportamento esperado:** Retorna apenas registros do período.

**Consultas antes:** 1
**Consultas depois:** 1
**Documentos antes:** Ilimitados
**Documentos depois:** Período selecionado
**Listeners antes:** 0
**Listeners depois:** 0
**Impacto em regras:** Nenhum
**Impacto em índices:** Requer índice `created_at` (automático)
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/reports/hooks/use-reports-data.ts`
**Critérios de aceite:**
- [ ] Relatório de equipes exibe dados do período correto
**Validação funcional:** Comparar contagem
**Rollback:** Remover filtro
**Dependências:** Nenhuma

---

### Cancelamento de Listeners

#### OPT-FS-107 — Verificar cleanup de listeners no dashboard

| Campo | Valor |
|-------|-------|
| **Status** | **CONCLUÍDO — Sem problema encontrado** |
| **Fase** | 1 |
| **Prioridade** | P0 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Problema investigado:** Memory leak se listeners não são cancelados no unmount.

**Resultado da investigação:** ✅ **NENHUM PROBLEMA ENCONTRADO POR ANÁLISE ESTÁTICA**

> **Nota sobre nível de confiança:** O cleanup está corretamente implementado no código analisado. A ausência de listeners residuais em runtime ainda depende de validação instrumentada (tests de navegação, instrumentação de development, Firebase Console metrics).

---

### 1. Diagnóstico — Mapeamento Completo de Listeners

#### Tabela de Listeners do Dashboard

| Listener | Arquivo | Linha | Tipo | Criado em | Dependências | Cleanup | Duplicação | Provider |
|----------|---------|-------|------|-----------|--------------|---------|------------|----------|
| `dogs` | entities-provider.tsx | 55 | onSnapshot | useEffect | nenhum | ✅ linha 110 | Não | Global |
| `users` | entities-provider.tsx | 73 | onSnapshot | useEffect | nenhum | ✅ linha 111 | Não | Global |
| `vehicles` | entities-provider.tsx | 91 | onSnapshot | useEffect | nenhum | ✅ linha 112 | Não | Global |
| `active_shifts` | dashboard/page.tsx | 155 | onSnapshot | useEffect | nenhum | ✅ linha 175 | Não | Local |
| `vehicle_crews` | dashboard/page.tsx | 155 | onSnapshot | useEffect | nenhum | ✅ linha 175 | Não | Local |
| `occurrences` | dashboard/page.tsx | 197 | onSnapshot | useEffect | nenhum | ✅ inline | Não | Local |
| `notifications` | dashboard/page.tsx | 217 | onSnapshot | useEffect | `profile?.ra` | ✅ inline | Não | Local |
| `promotion_requests` | dashboard/page.tsx | 230 | onSnapshot | useEffect | `isK9Instructor, ra` | ✅ inline | Não | Local |
| `shift_groups` | dashboard/page.tsx | 209 | subscribe | useEffect | nenhum | ✅ linha 211 | ⚠️ Sim | Local |
| `shift_assignments` | dashboard/page.tsx | 210 | subscribe | useEffect | nenhum | ✅ linha 211 | ⚠️ Sim | Local |
| `vehicle_crews/{id}/members` | use-crew-members.ts | 70 | onSnapshot | useEffect | `activeCrewIdsKey` | ✅ linhas 95-102 | Não | Local |
| `dogs` (counts) | effective/page.tsx | 103 | onSnapshot | useEffect | `path, filterActive` | ✅ linha 108 | ⚠️ Sim | Local |

---

### 2. Análise por Componente

#### 2.1 EntitiesProvider — Global

```typescript
// src/features/effective/providers/entities-provider.tsx:38-113
useEffect(() => {
  // 3 listeners: dogs, users, vehicles
  const unsubDogs = onSnapshot(dogsQuery, ...);
  const unsubUsers = onSnapshot(usersQuery, ...);
  const unsubVehicles = onSnapshot(vehiclesQuery, ...);
  
  return () => {
    unsubDogs();     // ✅ Cleanup
    unsubUsers();    // ✅ Cleanup
    unsubVehicles(); // ✅ Cleanup
  };
}, []);
```

**Veredicto:** ✅ Cleanup correto. Sem dependências = executa 1x. Não recria em re-renders.

---

#### 2.2 Dashboard page.tsx — Local

```typescript
// src/app/(app)/dashboard/page.tsx:149-176
useEffect(() => {
  const unsubscribes = paths.map(...)
  return () => { for (const unsub of unsubscribes) unsub(); }; // ✅
}, []);

// src/app/(app)/dashboard/page.tsx:187-206
useEffect(() => {
  return onSnapshot(occurrencesQuery, ...); // ✅ Cleanup inline
}, []);

// src/app/(app)/dashboard/page.tsx:208-212
useEffect(() => {
  const unsubGroups = subscribeShiftGroups(...);
  const unsubAssignments = subscribeShiftAssignments(...);
  return () => { unsubGroups(); unsubAssignments(); }; // ✅
}, []);
```

**Veredicto:** ✅ Todos os listeners possuem cleanup correto.

---

#### 2.3 useCrewMembers — Dinâmico

```typescript
// src/features/dashboard/hooks/use-crew-members.ts:46-92
useEffect(() => {
  // Cancelar subscriptions de crews inativas
  for (const [crewId, unsub] of unsubsRef.current) {
    if (!activeCrewIds.has(crewId)) {
      unsub();                        // ✅ Cleanup individual
      unsubsRef.current.delete(crewId);
    }
  }
  
  // Criar subscriptions para crews novas
  for (const crewId of activeCrewIds) {
    if (!unsubsRef.current.has(crewId)) {
      const unsub = onSnapshot(...);
      unsubsRef.current.set(crewId, unsub); // ✅ Map gerencia
    }
  }
}, [activeCrewIdsKey]); // ✅ Dependência estável (string)

useEffect(() => {
  return () => {
    for (const unsub of unsubsRef.current.values()) unsub(); // ✅
    unsubsRef.current.clear();
  };
}, []);
```

**Veredicto:** ✅ Gerenciamento refinado de listeners dinâmicos. Estabilização via string key evita recriações desnecessárias.

---

### 3. Problemas Investigados e Descartados

| # | Problema Hipotético | Resultado | Evidência |
|---|---------------------|----------|-----------|
| 1 | Memory leak por falta de cleanup | ❌ DESCARTADO | Todos os effects têm return cleanup |
| 2 | Duplicação por re-render | ❌ DESCARTADO | Dependencies estáveis |
| 3 | Listeners não encerram após navegação | ❌ DESCARTADO | useEffect unmount executa cleanup |
| 4 | Listeners dinâmicos não removidos | ❌ DESCARTADO | Loop de cleanup em activeCrewIdsKey |
| 5 | React Strict Mode causa duplicação | ⚠️ OBSERVAÇÃO | Comportamento esperado em dev |
| 6 | Navegação dashboard↔shifts duplica | ⚠️ OBSERVAÇÃO | Não é bug, é arquitetura |

---

### 4. Observações Arquiteturais

#### 4.1 React Strict Mode (Desenvolvimento)

Em desenvolvimento, React 18+ executa effects duas vezes para detectar efeitos colaterais. Isso causa:
- 2x criação de listeners temporariamente
- 2x cleanup

**Não é bug** — é comportamento esperado. Produção não é afetada.

#### 4.2 Duplicação dashboard↔shifts

| Página | Listeners shift_groups | Listeners shift_assignments |
|--------|----------------------|----------------------------|
| Dashboard | `subscribeShiftGroups()` | `subscribeShiftAssignments()` |
| Shifts page | ❌ Nenhum | `subscribeShiftAssignments()` |

Se usuário navega entre páginas, cada uma cria seus próprios listeners.

**Recomendação futura:** Criar provider compartilhado para turnos (OPT-FS-115).

---

### 5. Quantidade Estrutural de Listeners

#### Baseline ao abrir dashboard:

| Categoria | Fixo | Dinâmico | Total |
|-----------|------|----------|-------|
| EntitiesProvider (global) | 3 | 0 | 3 |
| Dashboard (local) | 8 | 0-20 | 8-28 |
| **Total por usuário** | **11** | **0-20** | **11-31** |

#### Com N crews ativas (useCrewMembers):

| N crews | Listeners crew members | Total |
|---------|------------------------|-------|
| 5 | 5 | 16 |
| 10 | 10 | 21 |
| 20 | 20 | 31 |
| 50 | 50 | 61 |

---

### 6. Conclusão

**NENHUM PROBLEMA DE MEMORY LEAK ENCONTRADO.**

O ciclo de vida dos listeners está corretamente implementado:
- Cleanup existe em todos os listeners
- Dependências são estáveis
- Listeners dinâmicos são gerenciados corretamente
- Unmount sempre executa cleanup

---

### 7. Arquivos Afetados (Nenhum — Verificação)

| Arquivo | Alteração Necessária |
|---------|---------------------|
| Nenhum | — |

---

### 8. Validações Executadas

| # | Validação | Resultado |
|---|-----------|-----------|
| 1 | Cleanup em EntitiesProvider | ✅ Confirmado |
| 2 | Cleanup em dashboard/page.tsx | ✅ Confirmado |
| 3 | Cleanup em useCrewMembers | ✅ Confirmado |
| 4 | Estabilização de dependências | ✅ Confirmado |
| 5 | Remoção de listeners dinâmicos | ✅ Confirmado |
| 6 | Cleanup em subscribeShiftGroups | ✅ Confirmado |
| 7 | Cleanup em subscribeShiftAssignments | ✅ Confirmado |

---

### 9. Recomendações Futuras (Fora do Escopo)

| # | Recomendação | Prioridade |
|---|--------------|------------|
| 1 | Criar provider compartilhado para turnos | P3 |
| 2 | Adicionar logging de listeners para debugging | P3 |
| 3 | Considerar lazy loading de effective/page | P2 |

---

### 10. Limitações da Validação

- Análise estática de código (não executou em produção)
- Não mediu heap snapshots
- Não simulou navegação real
- React Strict Mode não verificado empiricamente
- Volume real de crews não medido

---

### 11. Resultado Final

```diff
- Problema: Memory leak por falta de cleanup
+ Resultado: NENHUM PROBLEMA ENCONTRADO POR ANÁLISE ESTÁTICA
+ Cleanup correto em todos os listeners (confirmado no código)
+ Arquitetura adequada para ciclo de vida (verificação estática)
+ Validação runtime pendente (instrumentação não executada)
```

**Tarefa OPT-FS-107: CONCLUÍDA SEM ALTERAÇÕES DE CÓDIGO**
- Confiança: **Confirmado por análise estática**
- Runtime: **Requer validação instrumentada**

---

#### OPT-FS-108 — Verificar cleanup de listeners em `useHealthData`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ **CONCLUÍDA** |
| **Fase** | 1 |
| **Prioridade** | P0 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Resultado:** Cleanup confirmado por análise estática. N+1 listeners em `useHealthData` são limpos corretamente via `subscribeManyCollections`. Página `/health` não possui abas — lazy loading por aba não aplicável.

**Achado adicional:** OPT-FS-119 criada para otimização de `weight_records`.

**Código alterado:** Nenhum

**Validação runtime:** ⏳ Pendente

**Critérios validados:**
- [x] N+1 listeners são limpos quando componente unmount
- [x] useEffect retorna função de cleanup
- [x] `/health` é página única sem abas

---

### Compartilhamento de Subscriptions

#### OPT-FS-109 — Centralizar listeners de `dogs`, `users`, `vehicles`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Problema:** EntitiesProvider já centraliza, mas dashboard cria listeners redundantes.

**Evidência:**
```typescript
// src/app/(app)/dashboard/page.tsx:129-185
// Entidades via useEntities() + re-exposição manual
const { dogs: entityDogs, dogsLoading, users: entityUsers, usersLoading, vehicles: entityVehicles, vehiclesLoading } = useEntities();
```

**Comportamento atual:** Dashboard obtém entidades via provider e re-expoẽ em estado local.

**Alteração proposta:** Usar entidades diretamente do provider sem re-exposição.

**Comportamento esperado:** Eliminar duplicação de estado.

**Consultas antes:** 3 listeners (via useEntities)
**Consultas depois:** 3 listeners (via useEntities)
**Documentos antes:** N/A
**Documentos depois:** N/A
**Listeners antes:** 3 (EntitiesProvider) + 0 redundantes
**Listeners depois:** 3 (EntitiesProvider)
**Impacto em regras:** Nenhum
**Impacto em índices:** Nenhum
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/app/(app)/dashboard/page.tsx`
**Critérios de aceite:**
- [ ] Dashboard funciona sem re-exposição
- [ ] Performance melhora marginalmente
**Validação funcional:** Verificar comportamento do dashboard
**Rollback:** Restaurar re-exposição
**Dependências:** Nenhuma

---

#### OPT-FS-110 — Lazy loading de `useHealthData` por aba

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P1 |
| **Confiança** | Confirmado no código |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Saúde |

**Problema:** Health hooks carregam 150+ listeners mesmo quando aba não está visível.

**Evidência:**
```typescript
// src/features/health/hooks/use-health-data.ts:503-534
// subscribeManyCollections para 3 subcoleções × N dogs
```

**Comportamento atual:** Sempre carrega tudo quando página é renderizada.

**Alteração proposta:** Carregar apenas quando aba de saúde está visível.

**Comportamento esperado:** Listeners criados apenas quando aba visível.

**Consultas antes:** 1 + 3N listeners
**Consultas depois:** 1 + 3N listeners (quando visível)
**Documentos antes:** N/A
**Documentos depois:** N/A
**Listeners antes:** 1 + 3N (sempre)
**Listeners depois:** 1 + 3N (quando visível)
**Impacto em regras:** Nenhum
**Impacto em índices:** Nenhum
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/health/hooks/use-health-data.ts`
**Critérios de aceite:**
- [ ] Health tabs carregam dados quando selecionadas
- [ ] Não há flickering ao trocar abas
**Validação funcional:** Verificar listeners no Network tab
**Rollback:** Remover visibility check
**Dependências:** Nenhuma

---

### Eliminação de Consultas Repetidas

#### OPT-FS-111 — Remover consultas duplicadas em `useBinomialProfileData`

| Campo | Valor |
|-------|-------|
| **Status** | ⏸️ **BLOQUEADA** |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Plataforma** | Web |
| **Domínio** | Binômio |

**Investigação reavaliada (2026-07-10):**

1. **Queries encontradas:**
   - `trainingsDogQuery`: `where("dogId", "==", dogId)` — convenção camelCase (web)
   - `trainingsDogLegacyQuery`: `where("dog_id", "==", dogId)` — convenção snake_case (mobile)

2. **Afirmação anterior incorreta:** "Documentos só possuem UM dos campos"
   - ❌ **INCORRETO** — Mobile grava ambos os campos simultaneamente
   - Confirmado em `training_service.dart:64-70`:
     ```dart
     'dogId': dogId,
     'dog_id': dogId,  // mesmo valor
     'handlerId': handlerId,
     'handler_id': handlerId,  // mesmo valor
     ```

3. **Bug de deduplicação confirmado:**
   - Chave atual: `${_source}:${_id}` — usa `_source` como parte da chave
   - Doc mobile (mesmo `_id`) com ambos campos:
     - Query 1: `_source: "training_sessions"`, `_id: "xyz"` → chave `"training_sessions:xyz"`
     - Query 2: `_source: "training_sessions_legacy"`, `_id: "xyz"` → chave `"training_sessions_legacy:xyz"`
   - **Resultado:** mesmo documento aparece 2x no merge

4. **Avaliação de consolidação OR:**
   - SDK suporta `or`: ✅ (firebase@12.14.0)
   - Regras avaliam `resource.data`, não campo filtrado
   - OR query retornaria docs que podem não satisfazer `canReadTrainingData`
   - **Impedimento:** Rules avaliam documento completo

5. **Fixtures pendentes:**
   - ⏸️ Requerem Firebase Emulator ou acesso a produção

**Código alterado:** Nenhum

---

### Tarefas Adicionais da Fase 1

#### OPT-FS-112 — Verificar paginação existente em `occurrences`

| Campo | Valor |
|-------|-------|
| **Status** | ✅ **CONCLUÍDA SEM ALTERAÇÃO** |
| **Fase** | 1 |
| **Prioridade** | P1 |
| **Plataforma** | Web |
| **Domínio** | Dashboard |

**Investigação concluída (2026-07-11):**

**Query atual:**
```typescript
// src/app/(app)/dashboard/page.tsx:197-202
query(
  collection(db, "occurrences"),
  where("started_at", ">=", cutoff),   // 31 dias atrás
  orderBy("started_at", "desc"),
  limit(500),
)
```

| Aspecto | Resultado |
|---------|-----------|
| **Snapshot size observado** | **27 documentos** |
| **Limite atingido** | **Não** (`27 < 500`) |
| **Período real observado** | `2026-06-18` a `2026-07-11` |
| **Truncamento atual** | **Inexistente** |
| **Índice** | Campo único: `started_at DESC` (automático) |
| **orderBy explícito** | ✅ Presente |

**Consumidores e contratos:**

| Consumidor | Texto exibido | Período | Usa 31 dias |
|------------|---------------|---------|-------------|
| `occurrenceMetrics` | "Ocorrências do período" | 31 dias | ✅ |
| `pendingMetrics.finalizingOccurrences` | "Em finalização" | 31 dias | ✅ |
| `pendingMetrics.awaitingSignatureOccurrences` | "Aguardando assinaturas" | 31 dias | ✅ |
| `integrityMetrics.coverage` | "documentos selados" | 31 dias | ✅ |
| `drugStats` | "Drogas apreendidas" | 31 dias | ✅ |
| `OccurrenceSparkline` | "Tendência · N dias" | 31 dias | ✅ |

**Conclusão:**
- Todos os consumidores operam sobre os últimos 31 dias — nenhum promete histórico completo.
- Paginação não é adequada: métricas exigem completude do período; não existe listagem navegável.
- Limite de 500 é uma salvaguarda, não um contrato de completude.
- BUG-FS-003 não necessário: contrato alinhado com query.

**Risco futuro documentado:** Se o volume superar 500 ocorrências em 31 dias, métricas serão incorretas. Monitorar e separar queries de métricas e recentes se necessário.

**Código alterado:** Nenhum
**Instrumentação temporária:** Removida

---

#### OPT-FS-113 — Adicionar `orderBy` explícito em queries

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Problema:** Queries sem `orderBy` podem usar índice não ideal.

**Evidência:**
```typescript
// src/features/effective/hooks/use-effective-data.ts:358-362
onSnapshot(collection(db, "binomials"), [where("active", "==", true)])  // Sem orderBy
```

**Comportamento atual:** Ordenação implícita por ID do documento.

**Alteração proposta:** Adicionar `orderBy("dog_name", "asc")` explícito.

**Comportamento esperado:** Ordenação previsível, uso de índice otimizado.

**Consultas antes:** 1
**Consultas depois:** 1
**Documentos antes:** N/A
**Documentos depois:** N/A
**Listeners antes:** 1
**Listeners depois:** 1
**Impacto em regras:** Nenhum
**Impacto em índices:** Requer índice `active + dog_name` (não existe)
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/effective/hooks/use-effective-data.ts`
**Critérios de aceite:**
- [ ] Ordenação funciona corretamente
- [ ] Sem erros de índice
**Validação funcional:** Verificar ordenação na UI
**Rollback:** Remover orderBy
**Dependências:** Nenhuma

---

#### OPT-FS-114 — Verificar cancelamento de listeners em `useEffectiveData`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P0 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Problema:** N+1 listeners em specialties podem causar leaks.

**Evidência:**
```typescript
// src/features/effective/hooks/use-effective-data.ts:436
return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
```

**Comportamento atual:** Cleanup implementado.

**Comportamento esperado:** Manter e documentar.

**Consultas antes:** N/A
**Consultas depois:** N/A
**Documentos antes:** N/A
**Documentos depois:** N/A
**Listeners antes:** N+1
**Listeners depois:** N+1 (com cleanup)
**Impacto em regras:** Nenhum
**Impacto em índices:** Nenhum
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** Nenhum (verificação)
**Critérios de aceite:**
- [ ] N+1 listeners são limpos corretamente
**Validação funcional:** Chrome DevTools
**Rollback:** N/A
**Dependências:** Nenhuma

---

#### OPT-FS-115 — Consolidar listeners de `shift_groups` e `shift_assignments`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Turnos |

**Problema:** Dashboard e effective hook订阅 mesmas coleções separadamente.

**Evidência:**
```typescript
// src/app/(app)/dashboard/page.tsx:208-211
subscribeShiftGroups()
subscribeShiftAssignments()

// src/features/effective/data/shift-group-service.ts
// Mesmas funções usadas
```

**Comportamento atual:** Duas subscriptions para mesmas coleções.

**Alteração proposta:** Criar provider compartilhado para turnos.

**Comportamento esperado:** Uma subscription por coleção.

**Consultas antes:** 2 listeners duplicados
**Consultas depois:** 2 listeners únicos
**Documentos antes:** N/A
**Documentos depois:** N/A
**Listeners antes:** 4 (2+2 duplicados)
**Listeners depois:** 2 (compartilhados)
**Impacto em regras:** Nenhum
**Impacto em índices:** Nenhum
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/effective/providers/`
**Critérios de aceite:**
- [ ] Dados de turnos consistentes em todas as telas
**Validação funcional:** Verificar contagem de listeners
**Rollback:** Reverter para subscriptions separadas
**Dependências:** Nenhuma

---

#### OPT-FS-116 — Lazy loading de `useCrewMembers`

| Campo | Valor |
|-------|-------|
| **Status** | ❌ **CANCELADA** |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Plataforma** | Web |
| **Domínio** | Equipes |

**Decisão:** A premissa de "expandir crew" é **inválida**.

**Investigação concluída:**

1. **Fluxo de dados:** `vehicle_crews` → `useCrewMembers` → `crewMembers` → `useCrewPayload` → `EquipeCard`

2. **Componentes consumidores:**
   - `EquipeCard`: renderiza membros imediatamente
   - `CrewSlotCard` × 4: mostra callsign ou "Posto vago"
   - `K9OperationalPanel`: requer dog e conductorName
   - Métricas: `isCrewOperational`, contagem

3. **Interação de expansão:** ❌ **NÃO EXISTE**
   - 4 slots fixos renderizados na carga
   - Sem click handlers para expandir/recolher
   - Sem "detalhes" ou modais

4. **Dados necessários na renderização inicial:**
   - Motorista, Encarregado, Auxiliares (callsign, foto, função)
   - Cão em serviço
   - Nome do condutor K9
   - Status operacional

5. **Quantidade de listeners:** C (uma crew ativa = um listener)
   - Volume operacional típico: 3-5 crews
   - Não é materialmente problemático

**Alternativas analisadas:**
| Alternativa | Benefício | Risco |
|-------------|-----------|-------|
| Manter atual | Simples | — |
| Viewport loading | Reduz | Complexo |
| collectionGroup | Uma query | Índice |
| Resumo no pai | Zero listeners | Schema |

**Recomendação futura:**
Se houver necessidade de otimização, considerar:
1. `collectionGroup("members")` com índice composto
2. Denormalizar resumo no documento pai de `vehicle_crews`

**Código alterado:** Nenhum


**Critérios para cancelar:**
- [ ] Membros necessários para renderizar estado inicial dos cards
- [ ] Interface não possui interação de expandir/colapsar crew
- [ ] Número operacional de crews é pequeno
**Validação funcional:** Testar com múltiplas crews
**Rollback:** Restaurar criação imediata
**Dependências:** Nenhuma

---

#### OPT-FS-117 — Verificar filtros em `useAccessProfiles`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Acesso |

**Problema:** Profile de acesso pode carregar todos os perfis.

**Evidência:**
```typescript
// src/features/access/hooks/use-access-profiles.ts
// Presumido: sem filtro de status
```

**Comportamento atual:** Carrega todos os perfis.

**Alteração proposta:** Adicionar filtro `where("status", "==", "active")`.

**Comportamento esperado:** Retorna apenas perfis ativos.

**Consultas antes:** 1
**Consultas depois:** 1
**Documentos antes:** Todos perfis
**Documentos depois:** Perfis ativos
**Listeners antes:** 1
**Listeners depois:** 1
**Impacto em regras:** Nenhum
**Impacto em índices:** Requer índice (verificar)
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/access/hooks/use-access-profiles.ts`
**Critérios de aceite:**
- [ ] Perfis ativos funcionam corretamente
**Validação funcional:** Verificar lista de perfis
**Rollback:** Remover filtro
**Dependências:** Nenhuma

---

#### OPT-FS-118 — Verificar filtros em `useAccessUsers`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 1 |
| **Prioridade** | P2 |
| **Confiança** | Confirmado no código |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Acesso |

**Problema:** Lista de usuários pode carregar todos os usuários.

**Evidência:**
```typescript
// src/features/access/hooks/use-access-users.ts
// Presumido: sem filtro de status
```

**Comportamento atual:** Carrega todos os usuários.

**Alteração proposta:** Adicionar filtro `where("active", "==", true)`.

**Comportamento esperado:** Retorna apenas usuários ativos.

**Consultas antes:** 1
**Consultas depois:** 1
**Documentos antes:** Todos usuários
**Documentos depois:** Usuários ativos
**Listeners antes:** 1
**Listeners depois:** 1
**Impacto em regras:** Nenhum
**Impacto em índices:** Usa `active + ra` (existe)
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/access/hooks/use-access-users.ts`
**Critérios de aceite:**
- [ ] Lista de usuários funciona corretamente
**Validação funcional:** Verificar lista
**Rollback:** Remover filtro
**Dependências:** Nenhuma

---

## Fase 2 — Relatórios e Agregações

### Análise Individual de Cada Relatório

#### OPT-FS-201 — Documentar contrato do relatório de efetivo

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 2 |
| **Prioridade** | P1 |
| **Confiança** | Confirmado no código |
| **Risco** | Nenhum |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Finalidade:** Exibir efetivo atual (humanos, cães, viaturas, binômios).

**Período padrão:** Tempo real (não histórico).

**Filtros:**
- `dogs`: `active == true`
- `users`: `active == true`
- `vehicles`: `active == true`
- `binomials`: `active == true`

**Necessidade de completude:** Não — dados atuais são瞬時.

**Necessidade de detalhes:** Não — agregação é suficiente.

**Necessidade de exportação:** Não.

**Agregações:**
- Contagem de cães por status
- Contagem de humanos por papel
- Contagem de viaturas por status
- Contagem de binômios por especialidade

**Volume esperado:** ~50 dogs, ~100 users, ~30 vehicles, ~40 binomials.

**Frequência de uso:** Alta (diária).

**Estratégia recomendada:** **Consulta filtrada + Provider compartilhado** (já implementado via EntitiesProvider).

**Consultas antes:** 4 listeners + 1 N+1 (specialties)
**Consultas depois:** 4 listeners + 1 N+1 (specialties) — manter
**Documentos antes:** ~220
**Documentos depois:** ~220
**Listeners antes:** 5 + N specialties
**Listeners depois:** 5 + N specialties — manter
**Impacto em regras:** Nenhum
**Impacto em índices:** Usa `active + name`, `active + ra`, `active + prefix` (existem)
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** Nenhum (documentação)
**Critérios de aceite:**
- [ ] Documento define estratégia atual como adequada
**Validação funcional:** N/A
**Rollback:** N/A
**Dependências:** Nenhuma

---

#### OPT-FS-202 — Definir estratégia do relatório de ocorrências

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 2 |
| **Prioridade** | P1 |
| **Confiança** | Confirmado no código |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Finalidade:** Listar ocorrências de um período para análise.

**Período padrão:** Últimos 31 dias (dashboard).

**Filtros:**
- `started_at >= 31 dias atrás`
- `status in ["in_progress", "finalizing", "awaiting_signatures"]` (opcional)

**Necessidade de completude:** Sim para período selecionado.

**Necessidade de detalhes:** Sim — dados da ocorrência.

**Necessidade de exportação:** Sim (futuro).

**Volume esperado:** 500-2000 ocorrências/ano.

**Frequência de uso:** Média.

**Estratégia recomendada:** **Consulta filtrada por período + limite ajustável**.

**Complemento:** `count()` para métricas agregadas.

**Problema identificado:** 16 `getDocs()` em `use-reports-data.ts` sem limite.

**Arquivos afetados:** `src/features/reports/hooks/use-reports-data.ts`

**Contrato proposto:**

```
Relatório: Ocorrências
- Período: Obrigatório (start/end)
- Filtros: status (opcional)
- Detalhes: Sim (listagem)
- Agregações: count, sum(duração)
- Paginação: Sim (cursor)
- Exportação: Futura (admin only)
- Volume máximo: 1000 por página
```

---

#### OPT-FS-203 — Definir estratégia do relatório de treinamento

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 2 |
| **Prioridade** | P2 |
| **Confiança** | Fortemente indicado |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Finalidade:** Listar sessões de treinamento por período.

**Período padrão:** Últimos 90 dias.

**Filtros:**
- `created_at >= 90 dias atrás`
- `dog_id` (opcional)

**Necessidade de completude:** Sim para período.

**Necessidade de detalhes:** Sim.

**Necessidade de exportação:** Não.

**Volume esperado:** ~500-1000 sessões/ano.

**Frequência de uso:** Baixa.

**Estratégia recomendada:** **Consulta filtrada + paginação**.

**Problema identificado:** `collectionGroup("training_sessions")` sem filtro.

**Contrato proposto:**

```
Relatório: Treinamento
- Período: Obrigatório (start/end)
- Filtros: dog_id (opcional)
- Detalhes: Sim
- Agregações: count, avg(duração)
- Paginação: Sim (cursor por created_at)
- Exportação: Não
- Volume máximo: 500 por página
```

---

#### OPT-FS-204 — Definir estratégia do relatório de saúde

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 2 |
| **Prioridade** | P2 |
| **Confiança** | Fortemente indicado |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Finalidade:** Listar eventos de saúde por cão e período.

**Período padrão:** Últimos 365 dias.

**Filtros:**
- `created_at >= 365 dias atrás`
- `dog_id` (obrigatório para collectionGroup)

**Necessidade de completude:** Sim.

**Necessidade de detalhes:** Sim.

**Necessidade de exportação:** Sim (futuro).

**Volume esperado:** ~2000 eventos/ano.

**Frequência de uso:** Baixa.

**Estratégia recomendada:** **Consulta filtrada + collectionGroup** (requer índice).

**Problema identificado:** N+1 listeners para health_events.

**Contrato proposto:**

```
Relatório: Saúde
- Período: Obrigatório (start/end)
- Filtros: dog_id (obrigatório)
- Detalhes: Sim
- Agregações: count por tipo
- Paginação: Sim (cursor)
- Exportação: Futura
- Volume máximo: 500 por página
```

---

#### OPT-FS-205 — Definir estratégia do relatório de inventário

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 2 |
| **Prioridade** | P2 |
| **Confiança** | Fortemente indicado |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Finalidade:** Listar itens e movimentações.

**Período padrão:** Últimos 30 dias.

**Filtros:**
- `created_at >= 30 dias atrás`
- `category_id` (opcional)
- `status` (opcional)

**Necessidade de completude:** Sim para período.

**Necessidade de detalhes:** Sim.

**Necessidade de exportação:** Sim (futuro).

**Volume esperado:** ~100 items, ~500 movimentações/mês.

**Frequência de uso:** Média.

**Estratégia recomendada:** **Consulta filtrada + paginação**.

**Contrato proposto:**

```
Relatório: Inventário
- Período: Obrigatório (start/end)
- Filtros: category_id, status
- Detalhes: Sim
- Agregações: sum(quantidade)
- Paginação: Sim
- Exportação: Futura
- Volume máximo: 200 por página
```

---

#### OPT-FS-206 — Definir estratégia do relatório de shift_logs

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 2 |
| **Prioridade** | P2 |
| **Confiança** | Fortemente indicado |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Finalidade:** Listar logs de turnos por período.

**Período padrão:** Últimos 90 dias.

**Filtros:**
- `started_at >= 90 dias atrás`
- `handler_ra` (opcional)

**Necessidade de completude:** Sim.

**Necessidade de detalhes:** Sim.

**Necessidade de exportação:** Sim.

**Volume esperado:** ~5000 logs/ano.

**Frequência de uso:** Média.

**Estratégia recomendada:** **Consulta filtrada + paginação**.

**Contrato proposto:**

```
Relatório: Turnos
- Período: Obrigatório (start/end)
- Filtros: handler_ra, crew_id
- Detalhes: Sim
- Agregações: count, sum(duração)
- Paginação: Sim (cursor)
- Exportação: Sim (admin)
- Volume máximo: 500 por página
```

---

#### OPT-FS-207 — Implementar paginação com cursor

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 2 |
| **Prioridade** | P1 |
| **Confiança** | Confirmado no código |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Problema:** Não existe paginação em relatórios. Tudo é carregado de uma vez.

**Evidência:**
```typescript
// src/features/reports/hooks/use-reports-data.ts
// Sem startAfter, sem loadMore
```

**Comportamento atual:** Carrega tudo de uma vez.

**Alteração proposta:** Implementar `startAfter(documentSnapshot)` com botão "Carregar mais".

**Comportamento esperado:** Carrega páginas sob demanda.

**Consultas antes:** 1 (tudo)
**Consultas depois:** N (cada página)
**Documentos antes:** Ilimitados
**Documentos depois:** 500 por página
**Listeners antes:** 0
**Listeners depois:** 0
**Impacto em regras:** Nenhum
**Impacto em índices:** Usa cursor indexado
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/reports/hooks/use-reports-data.ts`
**Critérios de aceite:**
- [ ] "Carregar mais" funciona
- [ ] Contagem total exibida
- [ ] Scroll posição mantida
**Validação funcional:** Testar com dados reais
**Rollback:** Remover paginação
**Dependências:** Nenhuma

---

#### OPT-FS-208 — Implementar agregações `count()` em relatórios

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 2 |
| **Prioridade** | P1 |
| **Confiança** | Hipótese |
| **Risco** | Baixo |
| **Plataforma** | Web |
| **Domínio** | Relatórios |

**Problema:** Dashboard calcula métricas no cliente (pós-download).

**Evidência:**
```typescript
// src/features/dashboard/components/dashboard-utils.ts
// Cálculos pós-download
```

**Comportamento atual:** Download completo, depois agregação no cliente.

**Alteração proposta:** Usar `count()`, `sum()` para métricas simples.

**Comportamento esperado:** Métricas sem download completo.

**Consultas antes:** 1 (full download)
**Consultas depois:** 1 (count query)
**Documentos antes:** 500
**Documentos depois:** 1 (resultado de count)
**Listeners antes:** 0
**Listeners depois:** 0
**Impacto em regras:** Nenhum
**Impacto em índices:** Usa índice `status + started_at`
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** Múltiplos
**Critérios de aceite:**
- [ ] count() retorna valor correto
- [ ] Composable aggregates funcionam
**Validação funcional:** Comparar count com Firebase Console
**Rollback:** Reverter para cálculo cliente
**Dependências:** Firestore Standard/Enterprise (verificar suporte)

---

## Fase 3 — N+1 e Arquitetura de Leitura

### Análise Comparativa por Padrão N+1

#### OPT-FS-301 — Resolver N+1 em `health_events`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 3 |
| **Prioridade** | P2 |
| **Confiança** | Confirmado no código |
| **Risco** | Alto |
| **Plataforma** | Web |
| **Domínio** | Saúde |

**Implementação atual:**
```typescript
// 1 listener global + N listeners por cão
subscribeCollection("health_logs", ..., 500)
subscribeManyCollections(
  activeDogIds.map((dogId) => ({
    path: `dogs/${dogId}/health_events`,
  }))
)
```

**Análise comparativa:**

| Alternativa | Consultas | Listeners | Índice | Backfill | Regras | Risco |
|-------------|-----------|-----------|--------|----------|--------|-------|
| **Lazy loading** | 1 + 3N→1 + 3M | 3N→3M | Não | Não | Não | Baixo |
| **collectionGroup** | 2 | 2 | Sim | Não | Sim | Moderado |
| **Denormalização** | 1 | 1 | Não | Sim | Não | Alto |
| **Agregação materializada** | 1 | 1 | Não | Sim | Não | Alto |

**Recomendação:** OPT-FS-110 cancelada (página sem abas). collectionGroup pode ser avaliado independentemente se necessário.

**Estratégia:** Avaliar necessidade real antes de implementar collectionGroup.

**Consultas antes:** N/A
**Consultas depois:** N/A
**Documentos antes:** N/A
**Documentos depois:** N/A
**Listeners antes:** N/A
**Listeners depois:** N/A
**Impacto em regras:** Nenhum
**Impacto em índices:** Requer `dog_id + created_at` se collectionGroup
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma (lazy loading)
**Arquivos afetados:** `src/features/health/hooks/use-health-data.ts`
**Critérios de aceite:**
- [ ] Listeners reduzidos com lazy loading
- [ ] collectionGroup viável se necessário
**Validação funcional:** Verificar listeners no Network tab
**Rollback:** Reverter lazy loading
**Dependências:** Nenhuma (OPT-FS-110 cancelada)

---

#### OPT-FS-302 — Resolver N+1 em `specialties`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 3 |
| **Prioridade** | P2 |
| **Confiança** | Confirmado no código |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Efetivo |

**Implementação atual:**
```typescript
// 2 listeners base + N listeners por cão
dogIds.map((dogId) =>
  onSnapshot(collection(db, "dogs", dogId, "specialties"), ...)
)
```

**Análise comparativa:**

| Alternativa | Consultas | Listeners | Índice | Backfill | Regras | Risco |
|-------------|-----------|-----------|--------|----------|--------|-------|
| **Denormalizar em dogs** | 1 | 1 | Não | Sim | Não | Moderado |
| **collectionGroup** | 1 | 1 | Sim | Não | Sim | Moderado |
| **Cache local** | 1 | 1 | Não | Não | Não | Baixo |

**Recomendação:** Denormalizar specialties para `dogs/{id}` (subcollection → campo).

**Estratégia:** Adicionar campo `specialties[]` em `dogs` via Function.

**Consultas antes:** 2 + N
**Consultas depois:** 2
**Documentos antes:** N subcollection docs
**Documentos depois:** 0 (dados em dogs)
**Listeners antes:** 2 + N
**Listeners depois:** 2
**Impacto em regras:** Nenhum
**Impacto em índices:** Não
**Impacto em Functions:** Cloud Function para sync
**Migração:** Backfill dogs com specialties
**Arquivos afetados:** `functions/src/`, `src/features/effective/hooks/use-effective-data.ts`
**Critérios de aceite:**
- [ ] Specialties visíveis no perfil K9
- [ ] Sem regressões
**Validação funcional:** Verificar especialidades no perfil
**Rollback:** Restaurar subcollection queries
**Dependências:** Nenhuma

---

#### OPT-FS-303 — Resolver N+1 em `crew_members`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 3 |
| **Prioridade** | P2 |
| **Confiança** | Confirmado no código |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Equipes |

**Implementação atual:**
```typescript
// N listeners por crew ativa
activeCrewIds.map((crewId) =>
  onSnapshot(collection(db, "vehicle_crews", crewId, "members"), ...)
)
```

**Análise comparativa:**

| Alternativa | Consultas | Listeners | Índice | Backfill | Regras | Risco |
|-------------|-----------|-----------|--------|----------|--------|-------|
| **Lazy loading** | N→M | N→M | Não | Não | Não | Baixo |
| **Denormalizar em crew** | 1 | 1 | Não | Sim | Sim | Moderado |
| **collectionGroup** | 1 | 1 | Sim | Não | Sim | Moderado |

**Recomendação:** Lazy loading (OPT-FS-116) + manter como está.

**Estratégia:** Carregar membros apenas quando crew expandida.

**Consultas antes:** N
**Consultas depois:** M (M <= N)
**Documentos antes:** N/A
**Documentos depois:** N/A
**Listeners antes:** N
**Listeners depois:** M
**Impacto em regras:** Nenhum
**Impacto em índices:** Não
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma
**Arquivos afetados:** `src/features/dashboard/hooks/use-crew-members.ts`
**Critérios de aceite:**
- [ ] Membros carregam quando expandido
**Validação funcional:** Verificar expansão de crew
**Rollback:** Restaurar criação imediata
**Dependências:** OPT-FS-116

---

#### OPT-FS-304 — Resolver N+1 em `weight_records` e `documents`

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 3 |
| **Prioridade** | P3 |
| **Confiança** | Fortemente indicado |
| **Risco** | Alto |
| **Plataforma** | Web |
| **Domínio** | Saúde |

**Implementação atual:**
```typescript
// 3N listeners para weight_records e documents
subscribeManyCollections(
  activeDogIds.map((dogId) => ({
    path: `dogs/${dogId}/weight_records`,
  }))
)
subscribeManyCollections(
  activeDogIds.map((dogId) => ({
    path: `dogs/${dogId}/documents`,
  }))
)
```

**Recomendação:** Adiar para fase 4 (baixa frequência de mudança).

**Estratégia:** collectionGroup quando volume justificar.

**Consultas antes:** 2 + 2N
**Consultas depois:** 2 (collectionGroup)
**Documentos antes:** N/A
**Documentos depois:** N/A
**Listeners antes:** 2N + 2
**Listeners depois:** 2
**Impacto em regras:** Nenhum
**Impacto em índices:** Requer `dog_id + created_at`
**Impacto em Functions:** Nenhum
**Migração:** Nenhuma ainda
**Arquivos afetados:** `src/features/health/hooks/use-health-data.ts`
**Critérios de aceite:**
- [ ] Adiado para fase 4
**Validação funcional:** N/A
**Rollback:** N/A
**Dependências:** OPT-FS-301

---

#### OPT-FS-305 — Avaliar collectionGroup para subcoleções

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 3 |
| **Prioridade** | P2 |
| **Confiança** | Fortemente indicado |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Avaliação de collectionGroup:**

| Subcoleção | Volume | N+1 Atual | collectionGroup Vantajoso? |
|------------|--------|-----------|---------------------------|
| `health_events` | ~2000/ano | 3N | Sim (lazy loading primeiro) |
| `specialties` | ~50 docs | N | Sim (denormalizar) |
| `weight_records` | ~1000/ano | N | Sim |
| `documents` | ~500/ano | N | Sim |
| `members` | ~100/ano | N | Não (lazy OK) |

**Índices necessários para collectionGroup:**

```json
[
  { "collectionGroup": "health_events", "fields": [{ "fieldPath": "dog_id", "order": "ASC"}, {"fieldPath": "created_at", "order": "DESC"}] },
  { "collectionGroup": "weight_records", "fields": [{"fieldPath": "dog_id", "order": "ASC"}, {"fieldPath": "created_at", "order": "DESC"}] }
]
```

**Impacto estimado:**

| Métrica | Antes | Depois (collectionGroup) |
|---------|-------|--------------------------|
| Listeners | 150+ (50 dogs × 3) | 3 |
| Consultas Firestore | N×3 + 1 | 3 + 1 |
| Index entries | Normal | +2 índices |

**Dependências:** Índices devem ser criados primeiro.

---

#### OPT-FS-306 — Avaliar cache local para entidades compartilhadas

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 3 |
| **Prioridade** | P3 |
| **Confiança** | Hipótese |
| **Risco** | Moderado |
| **Plataforma** | Web |
| **Domínio** | Infraestrutura |

**Avaliação:**

| Entidade | Volume | Mudanças/Dia | Cache Vantajoso? |
|----------|--------|--------------|-----------------|
| `dogs` | ~50 | ~5 | Sim |
| `users` | ~100 | ~2 | Sim |
| `vehicles` | ~30 | ~1 | Sim |
| `binomials` | ~40 | ~2 | Sim |

**Estratégia:** React Query / SWR para cache com stale-while-revalidate.

**Impacto estimado:**

| Métrica | Antes | Depois |
|---------|-------|--------|
| Firestore reads | 150+ (init) | ~20 (refresh) |
| Cache hits | 0 | ~130 |
| Latência percebida | ~500ms | ~50ms (cache) |

**Dependências:** Análise de mobile (requer validação no repo canil-gcm).

---

## Fase 4 — Padronização e Migrações Futuras

### Tarefas de Longo Prazo

#### OPT-FS-401 — Definir campos canônicos

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 4 |
| **Prioridade** | P3 |
| **Confiança** | Confirmado no código |
| **Risco** | Crítico |
| **Plataforma** | Ambos |
| **Domínio** | Padronização |

**Problema:** Dual-casing (snake_case + camelCase) causa confusão e risco de divergência.

**Campos duplicados identificados:**

| snake_case | camelCase | Uso |
|------------|-----------|-----|
| `created_at` | `createdAt` | Timestamps |
| `updated_at` | `updatedAt` | Timestamps |
| `dog_id` | `dogId` | IDs |
| `handler_id` | `handlerId` | IDs |
| `shift_group_id` | `shiftGroupId` | IDs |

**Estratégia:**
1. Definir `snake_case` como canônico para novos campos
2. Migrar campos existentes gradualmente
3. Manter compatibilidade com versão mobile antiga

**Complexidade:** Alta — requer coordenação mobile + web.

**Dependências:** Validação com repo canil-gcm.

---

#### OPT-FS-402 — Remover aliases legados

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 4 |
| **Prioridade** | P3 |
| **Confiança** | Confirmado no código |
| **Risco** | Crítico |
| **Plataforma** | Ambos |
| **Domínio** | Padronização |

**Aliases identificados:**

| Alias | Canônico | Onde Usado |
|-------|----------|------------|
| `caoId` | `dogId` | dogs, occurrences |
| `nome` | `name` | Vários |
| `tipo` | `type` | Vários |
| `situação` | `status` | Vários |

**Estratégia:** Backfill + remoção gradual.

---

#### OPT-FS-403 — Criar documentos de resumo

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 4 |
| **Prioridade** | P3 |
| **Confiança** | Hipótese |
| **Risco** | Alto |
| **Plataforma** | Web |
| **Domínio** | Agregações |

**Documentos de resumo propostos:**

| Documento | Conteúdo | Atualização |
|-----------|----------|-------------|
| `dashboard_summary/{date}` | Contagens do dia | Cloud Function |
| `effective_daily/{date}` | Efetivo do dia | Cloud Function |
| `health_weekly` | Status saúde semanal | Scheduled Function |

**Impacto:**

| Métrica | Antes | Depois |
|---------|-------|--------|
| Dashboard reads | 50+ docs | 3-5 docs |
| Latência | ~1000ms | ~100ms |

---

#### OPT-FS-404 — Definir estratégia de migração de dados

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 4 |
| **Prioridade** | P3 |
| **Confiança** | Hipótese |
| **Risco** | Crítico |
| **Plataforma** | Ambos |
| **Domínio** | Migração |

**Migrações necessárias:**

| Migração | Complexidade | Risco | Dependências |
|----------|--------------|-------|--------------|
| Adicionar `specialties[]` em dogs | Média | Moderado | Cloud Function |
| Remover dual-casing | Alta | Alto | Coordinación mobile |
| Criar documentos de resumo | Alta | Moderado | Cloud Function |
| Adicionar campos faltantes | Baixa | Baixo | Backfill scripts |

---

#### OPT-FS-405 — Documentar incompatibilidades mobile/web

| Campo | Valor |
|-------|-------|
| **Status** | BACKLOG |
| **Fase** | 4 |
| **Prioridade** | P3 |
| **Confiança** | Confirmado no código |
| **Risco** | Moderado |
| **Plataforma** | Ambos |
| **Domínio** | Documentação |

**Incompatibilidades identificadas:**

| Área | Mobile (canil-gcm) | Web (k9-ops) | Compatível? |
|------|-------------------|--------------|--------------|
| Nomenclatura | camelCase predominante | snake_case predominante | Não |
| Schema health | Estrutura diferente | Estrutura diferente | Parcial |
| Auth | Firebase Auth + RA | Firebase Auth + RA | Sim |
| Offline | Suportado | Limitado | Parcial |

---

## BUG-FS-001 — Deduplicação de training_sessions

| Campo | Valor |
|-------|-------|
| **Status** | ✅ **CORRIGIDO** |
| **Data** | 2026-07-10 |
| **Arquivo** | `src/features/effective/hooks/use-binomial-profile-data.ts` |

### Problema

Deduplicação usava `${record._source}:${record._id}` como chave.
Quando o mobile grava um documento com ambos os campos `dogId` e `dog_id`,
o mesmo documento era retornado por dois listeners com _source diferente:

- `where("dogId", "==", dogId)` → `_source = "training_sessions"`
- `where("dog_id", "==", dogId)` → `_source = "training_sessions_legacy"`

Resultado: mesmo documento com `_id="xyz"` gerava duas chaves e aparecia duplicado.

### Solução

1. **Identidade canônica**: `canonicalSource()` normaliza `_source` para família real:
   - `"training_sessions"` → `"training_sessions"`
   - `"training_sessions_legacy"` → `"training_sessions"`
   - `"occurrences"` → `"occurrences"`
   - `"occurrences_legacy"` → `"occurrences"`

2. **Merge com precedência**:
   - Preferir registro com mais campos válidos
   - Em empate, preferir fonte canônica
   - Resultado determinístico (não depende da ordem)

3. **Arquivos alterados**:
   - `src/features/effective/lib/binomial-deduplication.ts` (novo)
   - `src/features/effective/hooks/use-binomial-profile-data.ts` (atualizado)
   - `src/features/effective/hooks/__tests__/binomial-deduplication.test.ts` (novo)

4. **Testes**: 19 testes unitários — todos passando

---

## Resumo e Primeira Onda

### Tarefas por Fase

| Fase | Tarefas | P0 | P1 | P2 | P3 |
|------|---------|----|----|----|----|
| 0 | 15 | 0 | 0 | 3 | 12 |
| 1 | 18 | 3 | 6 | 9 | 0 |
| 2 | 8 | 0 | 4 | 4 | 0 |
| 3 | 6 | 0 | 0 | 4 | 2 |
| 4 | 5 | 0 | 0 | 0 | 5 |
| **Total** | **52** | **3** | **10** | **20** | **19** |

---

### Top Cinco — Primeira Onda

Ordem exata de implementação:

| # | Tarefa | Prioridade | Fase | Status |
|---|--------|------------|------|--------|
| **1** | OPT-FS-107 | P0 | 1 | ✅ Concluída |
| **2** | OPT-FS-108 | P0 | 1 | ✅ Concluída |
| **3** | OPT-FS-101 | P1 | 1 | ✅ Implementada |
| **4** | OPT-FS-116 | P1 | 1 | ⏳ Backlog |
| **5** | OPT-FS-111 | P2 | 1 | ⏳ Backlog |

**Tarefas não incluídas na fila:**
- OPT-FS-110: ❌ CANCELADA — `/health` não possui abas
- OPT-FS-116: ❌ CANCELADA — membros aparecem diretamente nos cards
- OPT-FS-119: ⏳ BLOQUEADA — requer validação de schema

**Tarefas reavaliadas:**
- OPT-FS-111: ⏸️ **BLOQUEADA** — consolidação OR requer teste com Emulator e Rules

### Dependências Entre Tarefas

```
OPT-FS-103 ─┬─> OPT-FS-104 (criar índice)
            └─> (independente)

OPT-FS-119 ⏳ BLOQUEADA (validação de schema pendente)
OPT-FS-301 ─> (depende de futura necessidade de collectionGroup)
```

### Achados da Auditoria Que Não Viraram Tarefa

| # | Achado | Motivo |
|---|--------|--------|
| 1 | 37 Functions | Todas são callables de admin — sem otimização necessária |
| 2 | Security Rules com get() repetido | Firestore já cacheia — impacto zero em custo |
| 3 | Dual-casing aumenta escritas | Campos gravados juntos — zero impacto |
| 4 | Dashboard 24h = crítico | Custo depende de mudanças, não tempo — reclassificado |
| 5 | Mobile users snapshots | Requer análise no repo canil-gcm (fora do escopo) |

### Pontos Ainda Inconclusivos

| # | Ponto | Ação Necessária |
|---|-------|----------------|
| 1 | Quantos documentos por coleção? | Firebase Console |
| 2 | Plano Firebase? | Billing Console |
| 3 | CollectionGroup reduz custo real? | Medir antes/depois |
| 4 | 37 Functions são implantáveis? | Verificar deployment |
| 5 | Incompatibilidades mobile/web? | Analisar repo canil-gcm |

---

## Validação da Primeira Onda

### OPT-FS-107 — Verificar cleanup de listeners

| Aspecto | Detalhe |
|---------|---------|
| **Cenário funcional** | Abrir dashboard, navegar entre páginas, retornar |
| **Tela/fluxo afetado** | Todas as telas com listeners |
| **Consultas esperadas** | Sem mudança |
| **Documentos esperados** | Sem mudança |
| **Comportamento offline** | Listeners desconectam, reconectam |
| **Comportamento após reconexão** | Retornam dados normalmente |
| **Comparação antes/depois** | Heap snapshot antes e depois |
| **Métrica de ganho** | Heap size estável após múltiplas navegações |
| **Critério para rollback** | Memory leak detectado |

### OPT-FS-108 — Verificar cleanup em useHealthData

| Aspecto | Detalhe |
|---------|---------|
| **Cenário funcional** | Abrir página de saúde, navegar entre seções, sair |
| **Tela/fluxo afetado** | /health |
| **Resultado** | ✅ Cleanup confirmado por análise estática |

**Investigação Concluída:**

| # | Achado |
|---|--------|
| 1 | Página `/health` **não tem abas** — página única com scroll |
| 2 | Todas as subscriptions são necessárias simultaneamente |
| 3 | Todos os listeners possuem cleanup implementado |
| 4 | **Nenhuma alteração funcional necessária** |

**Status:** ✅ BACKLOG (nenhuma ação de código requerida — investigação concluída)

---

### Nova Tarefa — OPT-FS-119

#### OPT-FS-119 — Limitar weight_records ao último registro por K9

| Aspecto | Detalhe |
|---------|---------|
| **Tela/fluxo afetado** | /health |
| **Escopo** | Reduzir documentos retornados em `dogs/{dogId}/weight_records` |
| **Status** | ⏳ **Bloqueada por validação de schema** |

**Problema Identificado:**

A interface `useHealthData` usa apenas o último peso por cão para calcular `latestWeightKg`, `latestWeightAt` e status de peso. Uma otimização com `orderBy("measured_at", "desc") + limit(1)` reduz documentos retornados, mas:

| Risco | Descrição |
|-------|-----------|
| Registros sem `measured_at` | Excluídos da query, mesmo que mais recentes |
| Dados legados | Compatibilidade não confirmada |
| Semântica diferente | `measured_at` vs `created_at` podem ter significados distintos |

**Etapas necessárias antes de implementar:**

| # | Etapa | Status |
|---|-------|--------|
| 1 | Mapear schema real de `weight_records` | ⏳ Pendente |
| 2 | Identificar origens de escrita (web, mobile, Functions) | ⏳ Pendente |
| 3 | Confirmar campos temporais (`measured_at`, `created_at`, etc.) | ⏳ Pendente |
| 4 | Validar dados legados | ⏳ Pendente |
| 5 | Definir semântica de "último peso" | ⏳ Pendente |
| 6 | Escolher solução segura | ⏳ Pendente |

**Soluções possíveis:**

| Opção | Descrição | Risco |
|-------|-----------|-------|
| A | Manter query atual (sem limit) | Consulta todos os registros |
| B | Reverter | Sem otimização |
| C | Campo canônico `effective_at` + backfill | Requer migração |
| D | Duas queries (legado + novo) | Aumenta listeners |

**Regra de decisão:** Prefira correção funcional sobre economia de leituras.

**Índices:** Query simples com `orderBy(1 campo) + limit` usa índice de campo único automático. Não requer índice composto.

---

### OPT-FS-110 — Lazy loading de health tabs

> ❌ **CANCELADA** — A página `/health` não possui abas. Premissa original inválida.

---

### OPT-FS-101 — Filtrar vehicle_crews por active

| Aspecto | Detalhe |
|---------|---------|
| **Cenário funcional** | Abrir dashboard, verificar crews ativas |
| **Tela/fluxo afetado** | /dashboard |
| **Consultas esperadas** | 1 (igual) |
| **Documentos esperados** | ~20 em vez de ~50 |
| **Comportamento offline** | Funciona normalmente |
| **Comportamento após reconexão** | Retorna crews ativas |
| **Comparação antes/depois** | Contagem de crews no Firebase Console |
| **Métrica de ganho** | ~60% redução em documentos lidos |
| **Critério para rollback** | Crews inativas desaparecem |

### OPT-FS-110 — Lazy loading de health tabs

> ❌ **CANCELADA** — A página `/health` não possui abas. A premissa original era inválida.

### OPT-FS-116 — Lazy loading de crew members

| Aspecto | Detalhe |
|---------|---------|
| **Cenário funcional** | Abrir /dashboard, expandir crew, colapsar crew |
| **Tela/fluxo afetado** | /dashboard > Crew section |
| **Consultas esperadas** | Redução de listeners quando crew não expandida |
| **Documentos esperados** | Sem mudança |
| **Comportamento offline** | Listeners não criados até expandir |
| **Comportamento após reconexão** | Listeners criados quando expandido |
| **Comparação antes/depois** | Contagem de listeners |
| **Métrica de ganho** | N crews → M crews (M <= N, M = expandidas) |
| **Critério para rollback** | Membros não carregam |

---

## Entrega Final

| # | Item | Valor |
|---|------|-------|
| 1 | **Número total de tarefas** | **38** (headings `#### OPT-FS-*`) |
| 2 | **Tarefas por fase** | Fase 0: 15, Fase 1: 19, Fase 2: 8, Fase 3: 6, Fase 4: 5 |
| 3 | **Status OPT-FS** | Concluídas: 4, Canceladas: 2, Bloqueadas: 2, **Backlog: 30** |
| 4 | **Bugs corrigidos** | BUG-FS-001, BUG-FS-002 (2026-07-10) |
| 5 | **Primeira onda** | OPT-FS-112 ✅ concluída sem alteração (2026-07-11) |
| 6 | **Dependências** | OPT-FS-103 → OPT-FS-104; OPT-FS-119 bloqueada |
| 7 | **Achados que não viraram tarefa** | 37 Functions, Security Rules, Dual-casing, Mobile users |
| 8 | **Pontos inconclusivos** | Volume por coleção, plano Firebase, schema weight_records |
| 9 | **Validações manuais** | Firebase Console, Billing Console, Runtime |

---

## Histórico de Execução

| Data | Tarefa | Status | Nota |
|------|--------|--------|------|
| 2026-07-10 | OPT-FS-101 | ✅ Concluída | Filtro vehicle_crews por active |
| 2026-07-10 | OPT-FS-107 | ✅ Concluída | Memory leak não encontrado |
| 2026-07-10 | OPT-FS-108 | ✅ Concluída | Lazy loading não aplicável (sem abas) |
| 2026-07-10 | OPT-FS-110 | ❌ Cancelada | Premissa inválida |
| 2026-07-10 | OPT-FS-111 | ⏸️ Bloqueada | Consolidação OR requer Emulator |
| 2026-07-10 | OPT-FS-116 | ❌ Cancelada | Premissa inválida |
| 2026-07-10 | BUG-FS-001 | ✅ Corrigido | Deduplicação com identidade canônica |
| 2026-07-10 | BUG-FS-002 | ✅ Corrigido | Treinos e ocorrências classificados |

---

## Nota sobre versionamento de `docs/`

O diretório `docs/` está **untracked** no Git. Os documentos devem ser versionados:

```bash
git add docs/FIRESTORE_SCHEMA.md docs/FIRESTORE_OPTIMIZATION_PLAN.md docs/FIRESTORE_BASELINE.md
git commit -m "docs: add Firestore audit and optimization plan"
```

**Não adicione `docs/` ao `.gitignore`.** Esses documentos são contratos técnicos do projeto.

---

*Documento criado em: 2026-07-10*
*Última atualização: 2026-07-10 (limpeza documental)*
*Próximo passo: OPT-FS-101 — investigar filtragem de vehicle_crews por active*

