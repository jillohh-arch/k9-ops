# Firestore Baseline — K9 Ops

> Data: 2026-07-10
> Escopo: Dashboard Web + Módulo de Saúde
> Baseado em: `docs/FIRESTORE_SCHEMA.md`, `docs/FIRESTORE_OPTIMIZATION_PLAN.md`

---

## 1. Objetivo

Estabelecer linha de base mensurável para comparar o comportamento do Firestore antes e depois das otimizações da OPT-FS-101 e OPT-FS-119.

**Não mede custo monetário** — mede estrutura, volume e comportamento de subscriptions.

---

## 2. Ambiente da Medição

| Parâmetro | Valor |
|-----------|-------|
| Repositório | k9-ops |
| Firebase Project | canil-gcm |
| Região | southamerica-east1 |
| Firebase Edition | **A confirmar** (Standard ou Enterprise) |
| Plano | **A confirmar** (Spark/Blaze/Flame) |
| Ambiente | Local / Desenvolvimento |
| Data da medição | 2026-07-10 |

---

## 3. Metodologia

### 3.1 Análise Estática (Código)

Para cada componente analisado:
1. Identificar todas as chamadas a `onSnapshot()`
2. Identificar listeners fixos vs dinâmicos
3. Mapear dependências dos useEffect
4. Documentar mecanismos de cleanup
5. Identificar queries e filtros aplicados
6. Documentar limites e ordenações

### 3.2 Análise de Runtime (Pendente)

| Métrica | Status |
|---------|--------|
| Documentos no snapshot inicial | ⏳ Requer Firebase Console |
| Callbacks disparados por sessão | ⏳ Requer instrumentação |
| Subscriptions simultâneas | ⏳ Requer instrumentação |
| Comportamento em navegação | ⏳ Requer teste manual |
| React Strict Mode | ⏳ Requer ambiente dev |
| Reconexões | ⏳ Requer Firebase Console |

---

## 4. Baseline do Dashboard

### 4.1 Estrutura de Listeners

#### Providers Globais (carregados uma vez)

| # | Provider | Coleção | Filtro | Listener | Cleanup |
|---|----------|---------|--------|----------|---------|
| 1 | EntitiesProvider | `dogs` | `active == true` | onSnapshot | ✅ linha 110 |
| 2 | EntitiesProvider | `users` | `active == true` | onSnapshot | ✅ linha 111 |
| 3 | EntitiesProvider | `vehicles` | `active == true` | onSnapshot | ✅ linha 112 |

#### Listeners Locais (dashboard/page.tsx)

| # | Coleção | Filtro | Limite | Listener | Cleanup |
|---|---------|--------|--------|----------|---------|
| 4 | `active_shifts` | Nenhum | — | onSnapshot | ✅ linha 175 |
| 5 | `vehicle_crews` | `active == true` ✅ | — | onSnapshot | ✅ linha 175 |
| 6 | `occurrences` | `started_at >= 31d` | 500 | onSnapshot | ✅ inline |
| 7 | `notifications` | `docId == ra` | — | onSnapshot | ✅ inline |
| 8 | `promotion_requests` | `requester_ra == ra` | — | onSnapshot | ✅ inline |

> ✅ **OPT-FS-101 concluída:** Filtro `active == true` adicionado ao listener de `vehicle_crews`.

#### Listeners via Service (shift-group-service.ts)

| # | Coleção | Filtro | Listener | Cleanup | Compartilhado |
|---|---------|--------|----------|---------|---------------|
| 9 | `shift_groups` | `active == true` | subscribe | ✅ linha 355 | Não |
| 10 | `user_shift_assignments` | `active == true` | subscribe | ✅ linha 374 | Não |

#### Listeners Dinâmicos

| # | Coleção | Dinâmico | Listener | Cleanup | Condição |
|---|---------|----------|----------|---------|----------|
| 11 | `vehicle_crews/{id}/members` | Sim | onSnapshot | ✅ linhas 95-102 | Por crew ativa |

### 4.2 Quantidade de Listeners por Cenário

| Cenário | Fixos | Dinâmicos | Total |
|---------|------:|----------:|------:|
| Dashboard (5 crews) | 10 | 5 | **15** |
| Dashboard (10 crews) | 10 | 10 | **20** |
| Dashboard (20 crews) | 10 | 20 | **30** |
| Dashboard (50 crews) | 10 | 50 | **60** |

### 4.3 Fórmula

```
Listeners do Dashboard = 10 (fixos) + N (crews ativas)
```

**Otimização OPT-FS-101 implementada:**
- Query `vehicle_crews` agora filtra `active == true` no Firestore
- Reduz documentos entregues: todas → apenas ativas
- Listeners de membros: C (mesmo número, pois filtrava localmente antes)

### 4.4 Baseline Estrutural — Dashboard

| Métrica | Valor | Fonte |
|---------|------:|-------|
| Listeners fixos | 10 | Código |
| Listeners proporcionais a N crews | N | Código |
| Consultas one-time | 0 | Código |
| Filtros aplicados | 5 de 10 | Código |
| Limites aplicados | 1 (occurrences: 500) | Código |
| Mecanismos de cleanup | ✅ Todos | Código |
| Queries sem filtro | 5 | Código |

---

## 5. Baseline do Módulo de Saúde

### 5.1 Estrutura de Listeners (useHealthData)

#### Fonte | Escopo | Início | Encerramento | Depende da aba | Documentos iniciais

| # | Fonte | Escopo | Início | Encerramento | Depende da aba | Observação |
|---|-------|--------|--------|--------------|----------------|------------|
| 1 | `health_logs` | Global | useEffect | unmount | ❌ Não | Coleção raiz |
| 2 | `documentos` | Global | useEffect | unmount | ❌ Não | Coleção raiz |
| 3 | `dogs/{dogId}/health_events` | Por cão | useEffect | unmount | ❌ Não | N listeners |
| 4 | `dogs/{dogId}/weight_records` | Por cão | useEffect | unmount | ❌ Não | N listeners |
| 5 | `dogs/{dogId}/documents` | Por cão | useEffect | unmount | ❌ Não | N listeners |

### 5.2 Fórmula de Listeners por Número de Cães

```
Listeners fixos de saúde = 2 (health_logs + documentos)
Listeners por cão = 3 (health_events + weight_records + documents)
Total com N cães ativos = 2 + 3N
```

### 5.3 Baseline Estrutural — Saúde

| Cenário | Fixos | Por cão | Total |
|---------|------:|--------:|------:|
| 10 cães ativos | 2 | 30 | **32** |
| 20 cães ativos | 2 | 60 | **62** |
| 50 cães ativos | 2 | 150 | **152** |

### 5.4 Investigação OPT-FS-108 (Concluída)

> **Resultado:** Página `/health` não possui abas. É uma página única com scroll.

| # | Achado |
|---|--------|
| 1 | Página `/health` é página única, sem navegação por abas |
| 2 | Todas as subscriptions são necessárias simultaneamente |
| 3 | Listeners por cão (health_events, weight_records, documents) são todos usados |
| 4 | Cleanup implementado em todos os listeners |
| 5 | **Nenhuma alteração funcional necessária** |

**Status:** ✅ Concluída — investigação sem necessidade de código

---

## 6. Baseline de useHealthData — Detalhado

### 6.1 Código Analisado

```typescript
// src/features/health/hooks/use-health-data.ts

// Linhas 486-491: Listeners globais
useEffect(() => {
  const unsubscribes = [
    subscribeCollection("health_logs", setRootHealthLogsState, 500),
    subscribeCollection("documentos", setRootDocumentsState),
  ];
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}, []);

// Linhas 503-512: health_events por cão
useEffect(() => {
  if (dogsState.loading) return;
  return subscribeManyCollections(
    activeDogIds.map((dogId) => ({
      key: dogId,
      path: `dogs/${dogId}/health_events`,
    })),
    setHealthEventsState,
  );
}, [activeDogIds, dogsState.loading]);

// Linhas 514-523: weight_records por cão
useEffect(() => {
  if (dogsState.loading) return;
  return subscribeManyCollections(
    activeDogIds.map((dogId) => ({
      key: dogId,
      path: `dogs/${dogId}/weight_records`,
    })),
    setWeightRecordsState,
  );
}, [activeDogIds, dogsState.loading]);

// Linhas 525-534: documents por cão
useEffect(() => {
  if (dogsState.loading) return;
  return subscribeManyCollections(
    activeDogIds.map((dogId) => ({
      key: dogId,
      path: `dogs/${dogId}/documents`,
    })),
    setDocumentsState,
  );
}, [activeDogIds, dogsState.loading]);
```

### 6.2 Tabela Detalhada de Subscriptions

| Fonte | Escopo | Início | Encerramento | Depende da aba | Limite | Ordenação |
| ----- | ------ | ------ | ------------ | ------------- | ------ | --------- |
| `health_logs` (raiz) | Global | Imediato | unmount | ❌ | 500 | `created_at desc` |
| `documentos` (raiz) | Global | Imediato | unmount | ❌ | — | — |
| `dogs/{id}/health_events` | Por cão | `activeDogIds` muda | unmount | ❌ | — | — |
| `dogs/{id}/weight_records` | Por cão | `activeDogIds` muda | unmount | ❌ | — | — |
| `dogs/{id}/documents` | Por cão | `activeDogIds` muda | unmount | ❌ | — | — |

### 6.3 Dependências dos Effects

| Effect | Dependências | Re-executa quando |
|--------|--------------|-------------------|
| health_logs | nenhuma | unmount |
| documentos | nenhuma | unmount |
| health_events | `activeDogIds`, `dogsState.loading` | cães mudam |
| weight_records | `activeDogIds`, `dogsState.loading` | cães mudam |
| documents | `activeDogIds`, `dogsState.loading` | cães mudam |

---

## 7. Resultados Estruturais

### 7.1 Dashboard

| Métrica | Valor |
|---------|------:|
| Listeners fixos | 10 |
| Listeners dinâmicos (por crew) | C |
| Consultas one-time | 0 |
| Queries com where/limit | 1 (`occurrences` com 31d + 500) |
| Queries sem where/limit/recorte temporal | 9 |
| Mecanismos de cleanup | ✅ Confirmados por análise estática |

### 7.2 Saúde

| Métrica | Valor |
|---------|------:|
| Listeners fixos | 2 |
| Listeners por cão | 3 |
| Listeners proporcionais a D cães | 3D |
| Consultas one-time | 0 |
| Queries com where/limit | 1 (`health_logs` com limit 500) |
| Queries sem where/limit/recorte temporal | 4 (3 subcoleções + documentos) |
| Mecanismos de cleanup | ✅ Confirmados por análise estática |
| Depende de aba visível | ❌ **NÃO** — página única sem abas |
| Otimização weight_records | ⏳ Bloqueada (OPT-FS-119) — requer validação de schema |

---

## 8. Resultados Medidos em Runtime

| Métrica | Dashboard | Saúde |
|---------|----------:|------:|
| Listeners fixos criados | ⏳ | ⏳ |
| Listeners dinâmicos criados | ⏳ | ⏳ |
| Consultas one-time | ⏳ | ⏳ |
| Documentos no snapshot inicial | ⏳ | ⏳ |
| Eventos de snapshot após estabilização | ⏳ | ⏳ |
| Listeners removidos no unmount | ⏳ | ⏳ |
| Listeners recriados ao retornar | ⏳ | ⏳ |
| Subscriptions simultâneas máximas | ⏳ | ⏳ |
| Consultas vazias | ⏳ | ⏳ |
| Reconexões observadas | ⏳ | ⏳ |

> ⏳ = Requer medição em runtime ou Firebase Console

### 8.1 OPT-FS-112 — Medição runtime de `occurrences` (2026-07-11)

| Parâmetro | Valor |
|-----------|-------|
| `snapshot.size` | **27 documentos** |
| Limite configurado | 500 |
| Limite atingido | **Não** (`reachedLimit: false`) |
| Data mais recente observada | 2026-07-11 |
| Data mais antiga observada | 2026-06-18 |
| Período coberto | ~23 dias (dentro da janela de 31d) |
| Truncamento | **Inexistente** |
| Aggregate query adicional | **Não executada** (limite não atingido) |

**Conclusão da OPT-FS-112:** Query mantida sem alteração. Paginação não aplicável — todos os consumidores operam sobre os 31 dias e exigem completude do período; não existe listagem navegável. O limite de 500 funciona como salvaguarda, não como contrato de completude.

---

## 9. Métricas do Firebase Console

| Métrica | Valor | Data |
|---------|------|------|
| Leituras por dia | ⏳ | — |
| Escritas por dia | ⏳ | — |
| Exclusões por dia | ⏳ | — |
| Armazenamento total | ⏳ | — |
| Custo Functions | ⏳ | — |
| Horário da medição | ⏳ | — |
| Usuários ativos | ⏳ | — |

---

## 10. Limitações

| # | Limitação | Impacto |
|---|-----------|---------|
| 1 | Análise estática apenas | Não confirma runtime behavior |
| 2 | Sem acesso ao Firebase Console | Não mediu volume real |
| 3 | Sem instrumentação | Não contou callbacks |
| 4 | Sem teste de navegação | Não confirmou cleanup em router |
| 5 | React Strict Mode não verificado | Pode mostrar duplicação em dev |
| 6 | Sem Firebase Emulator | Não mediureads/writes |

---

## 11. Critérios para Comparação Posterior

### 11.1 Critérios para OPT-FS-119 (Limitar weight_records)

> ⚠️ **Bloqueada** — aguardando validação de schema e dados legados.

| # | Critério | Antes | Depois | Status |
|---|----------|-------|--------|--------|
| 1 | Documentos por cão em weight_records | N | 1 | ⏳ Aguardando schema |
| 2 | Compatibilidade com registros sem `measured_at` | N/A | Confirmar | ⏳ Pendente |
| 3 | Semântica de "último peso" | N/A | Confirmar | ⏳ Pendente |
| 4 | Índices necessários | Nenhum | ASC/DESC (auto) | ⏳ Confirmar |

### 11.2 NÃO Usar

- Percentuais de economia sem medição real
- "X% menos leituras" sem baseline de runtime
- "Custo reduzido em R$Y" sem Firebase Console
- "Listeners reduzidos" — a otimização não reduz listeners

---

## 12. Validações Manuais Pendentes

| # | Validação | Ferramenta | Prioridade |
|---|-----------|------------|------------|
| 1 | Documentos no snapshot inicial | Firebase Console | 🔴 Alta |
| 2 | Listeners em runtime | Chrome DevTools | 🔴 Alta |
| 3 | Comportamento em navegação | Teste manual | 🟠 Média |
| 4 | React Strict Mode | Ambiente dev | 🟠 Média |
| 5 | Firebase Edition/Plano | Billing Console | 🔴 Alta |
| 6 | Leituras/dia | Usage Dashboard | 🟠 Média |

---

## 13. Instrumentação Temporária (Se Necessário)

Se a validação de runtime for indispensável, criar wrapper centralizado:

```typescript
// src/lib/debug/firestore-spy.ts (DESENVOLVIMENTO APENAS)
const subscriptions = new Map<string, { created: number; key: string }>();

export function spyOnSnapshot(path: string, key: string) {
  return (unsubscribe: () => void) => {
    subscriptions.set(key, { created: Date.now(), key });
    console.log("[FirestoreSpy] subscription_created", { key, path });
    
    return () => {
      subscriptions.delete(key);
      console.log("[FirestoreSpy] subscription_removed", { key });
      unsubscribe();
    };
  };
}
```

**Restrições:**
- Apenas em desenvolvimento (`process.env.NODE_ENV === 'development'`)
- Não registra conteúdo de documentos
- Não afeta queries
- Removível facilmente

---

## 14. Resumo

### Baseline Estrutural

| Componente | Listeners Fixos | Listeners Dinâmicos | Fórmula |
|------------|----------------:|--------------------:|---------|
| Dashboard | 10 | C crews | `10 + C` |
| Saúde | 2 | 3D cães | `2 + 3D` |

Onde:
- `C` = número de crews ativas (Dashboard)
- `D` = número de cães ativos (Saúde)

**Nota:** Dashboard e Saúde são rotas separadas. Não permanecem simultaneamente montados durante navegação típica, portanto não há "total combinado" aplicável.

### Oportunidade de Otimização

| Componente | Problema | Status |
|------------|---------|--------|
| Saúde | Página sem abas — lazy loading não aplicável | N/A (sem abas) |
| Saúde | `weight_records` retorna todos os registros | ⏳ Bloqueada por validação de schema (OPT-FS-119) |

### OPT-FS-119 — Documentada, Aguardando Validação

| # | Item | Status |
|---|------|--------|
| 1 | Schema real de `weight_records` | ⏳ Pendente |
| 2 | Campos temporais (`measured_at`, `created_at`, etc.) | ⏳ Pendente |
| 3 | Dados legados sem `measured_at` | ⏳ Pendente |
| 4 | Semântica de "último peso" | ⏳ Pendente |
| 5 | Solução segura | ⏳ Pendente |

**Regra:** Prefira correção funcional sobre economia de leituras.

### Próximos Passos

1. ✅ Implementar OPT-FS-101 (filtrar vehicle_crews) — **concluído**
2. ⏳ Validar OPT-FS-101 em runtime (crews ativas, transição, cleanup)
3. ⏳ Mapear schema de `weight_records` (origens web, mobile, Functions)
4. ⏳ Validar campos temporais em todos os registros
5. ⏳ Confirmar semântica de `measured_at` vs `created_at`
6. ✅ Investigar OPT-FS-116 — **CANCELADA** (membros aparecem diretamente, sem expansão)
7. ✅ Investigar OPT-FS-111 — **BLOQUEADA** (não é duplicação, mas consolidação OR tem impedimentos: Rules avaliam documento, docs mobile têm ambos campos, bug de deduplicação confirmado)
8. ✅ Investigar OPT-FS-112 — **CONCLUÍDA SEM ALTERAÇÃO** (snapshot=27, limite=500, sem truncamento, paginação não aplicável)

---

*Documento criado: 2026-07-10*
*Última atualização: 2026-07-11 (OPT-FS-112 medição runtime)*
*Baseado em: `docs/FIRESTORE_SCHEMA.md`, `docs/FIRESTORE_OPTIMIZATION_PLAN.md`*
