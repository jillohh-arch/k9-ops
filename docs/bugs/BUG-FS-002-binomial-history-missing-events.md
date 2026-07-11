# BUG-FS-002 — Histórico do binômio não exibe treinos nem ocorrências

## Status

| Campo | Valor |
|-------|-------|
| **Status** | ✅ **CORRIGIDO E VALIDADO EM RUNTIME** |
| **Data** | 2026-07-10 |
| **Prioridade** | P0 |
| **Validação** | Runtime aprovado em 2026-07-10 |

## Sintoma

No perfil do binômio Ragonha + Bono:
- Treino de ontem: não aparecia
- Treino de hoje: não aparecia
- Ocorrências: não apareciam
- Eventos de turno (active, ended): apareciam

## Causa Raiz

O hook `useBinomialProfileData` consultava apenas a coleção raiz `training_sessions`,
mas o mobile grava os treinos em **duas fontes diferentes**:

| Fonte | Path | Status |
|-------|------|--------|
| ❌ ** NÃO consultada** | `training_sessions` (raiz) | Mobile não grava aqui |
| ❌ ** NÃO consultada** | `trainings` (raiz) | Mobile grava aqui (linha 25 de `training_service.dart`) |
| ✅ **FONTE CANÔNICA** | `dogs/{dogId}/training_sessions` | Mobile grava aqui (linha 57 de `training_service.dart`) |

### Código do Mobile (training_service.dart)

```dart
// Linha 25-29: Grava em trainings (raiz)
final docRef = _firestore.collection('trainings').doc();
await docRef.set({...after, ...});

// Linha 48-58: Grava em dogs/{dogId}/training_sessions (subcoleção)
final docRef = _firestore
    .collection('dogs')
    .doc(dogId)
    .collection('training_sessions')
    .doc();
await docRef.set({...after, ...});
```

## Investigação Realizada

### Etapa 1: Identificação dos Escritores

| Plataforma | Arquivo | Path Gravado |
|------------|---------|--------------|
| Mobile | `training_service.dart:25` | `trainings` (raiz) |
| Mobile | `training_service.dart:57` | `dogs/{dogId}/training_sessions` (subcoleção) |

### Etapa 2: Comparação com Fontes do Hook

| Hook | Path Consultado | Gravado pelo Mobile? |
|------|-----------------|----------------------|
| `useBinomialProfileData` | `training_sessions` | ❌ Não |
| `useBinomialProfileData` | `training_sessions` (dog_id) | ❌ Não |
| `use-k9-profile-data.ts` | `dogs/{dogId}/training_sessions` | ✅ Sim |
| `use-k9-profile-data.ts` | `training_sessions` (raiz) | ❌ Não |
| `use-k9-profile-data.ts` | `trainings` (raiz) | ✅ Sim |

## Correção Implementada

### Arquivos Alterados

1. **`src/features/effective/hooks/use-binomial-profile-data.ts`**
   - Adicionadas queries para:
     - `dogs/{dogId}/training_sessions` (subcoleção - FONTE CANÔNICA)
     - `trainings` (raiz)

2. **`src/features/effective/lib/binomial-deduplication.ts`**
   - Atualizado `SOURCE_FAMILY_MAP` para incluir:
     - `dogs_training_sessions` → `training_sessions`
     - `trainings` → `training_sessions`

### Diff Funcional

```typescript
// ANTES: Apenas collection raiz
const trainingsDogQuery = useMemo(
  () => query(collection(db, "training_sessions"), where("dogId", "==", dogId)),
  [dogId],
);

// DEPOIS: Inclui subcoleção e trainings (raiz)
const trainingsSubcollectionQuery = useMemo(
  () => dogId
    ? query(collection(db, "dogs", dogId, "training_sessions"))
    : null,
  [dogId],
);
const trainingsRootQuery = useMemo(
  () => query(collection(db, "trainings"), where("dogId", "==", dogId)),
  [dogId],
);
```

## Validações

| # | Validação | Resultado |
|---|-----------|-----------|
| 1 | `npm run typecheck` | ✅ Passed |
| 2 | `npx eslint` | ✅ No errors |
| 3 | `npm test` | ✅ 283 tests passed |
| 4 | Build | ⚠️ Erro pré-existente (não relacionado) |

## Testes Adicionados

| # | Teste | Descrição |
|---|-------|-----------|
| 1 | `dogs_training_sessions canonicalization` | Subcoleção normaliza para training_sessions |
| 2 | `trainings canonicalization` | Coleção raiz normaliza para training_sessions |
| 3 | `deduplicates same training across multiple sources` | Mesmo treino em múltiplas fontes resulta em 1 registro |
| 4 | `prefers training with more fields from subcoleção` | Merge usa precedência por campos válidos |

## Relação com BUG-FS-001

| Bug | Escopo | Relação |
|-----|--------|---------|
| BUG-FS-001 | Deduplicação de registros duplicados | Complementar |
| BUG-FS-002 | Registros que nunca eram retornados | Causa raiz diferente |

O BUG-FS-001 corrige duplicatas de documentos que **chegam** ao hook.
O BUG-FS-002 corrige a ausência de documentos que **nunca chegavam** ao hook.

## Lições Aprendidas

1. **Não presumir paths com base na documentação**: Confirmar pelo código escritor
2. **Verificar código do mobile**: O web não é a única fonte de dados
3. **Comparar hooks do mesmo domínio**: `use-k9-profile-data.ts` já tinha a implementação correta
4. **Fontes múltiplas são comuns**: Mobile grava em múltiplos lugares para compatibilidade

## Causas Raiz Finais

### 1. Treinos não apareciam

**Problema:** O histórico consultava fontes diferentes das utilizadas pelo mobile.

**Solução:** Adicionadas queries para `dogs/{dogId}/training_sessions` e `trainings`.

### 2. Classificação incorreta

**Problema:** A fonte "trainings" caía na categoria "Outro".

**Solução:** Atualizado classificador `category()` em `history/page.tsx`.

### 3. Ocorrências filtradas

**Problema:** Os documentos chegavam aos snapshots (27 docs confirmados), mas eram descartados porque `matchesRa` não reconhecia `primaryHandlerRa` / `primary_handler_ra`.

**Solução:** Adicionados campos de primary handler ao `matchesRa()`.

## Validações

| # | Validação | Resultado |
|---|-----------|-----------|
| 1 | `npm run typecheck` | ✅ Passed |
| 2 | `npx eslint` | ✅ No errors |
| 3 | `npm test` | ✅ 298 tests passed |
| 4 | `git diff --check` | ✅ No errors |

## Validação Runtime (2026-07-10)

| # | Verificação | Status |
|---|-------------|--------|
| 1 | Treino de ontem aparece | ✅ Aprovado |
| 2 | Treino de hoje aparece | ✅ Aprovado |
| 3 | Ocorrências aparecem | ✅ Aprovado |
| 4 | Cada treino aparece uma vez | ✅ Aprovado |
| 5 | Filtros funcionam | ✅ Aprovado |
| 6 | Badges corretos | ✅ Aprovado |

## Arquivos

```
src/features/effective/hooks/use-binomial-profile-data.ts     | modificado
src/features/effective/lib/binomial-deduplication.ts          | modificado
src/features/effective/hooks/__tests__/binomial-deduplication.test.ts | modificado
```

---

*Documento criado: 2026-07-10*
*Baseado em: Investigação de BUG-FS-002*
