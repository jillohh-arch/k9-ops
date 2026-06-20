# Auditoria — Painel Web K9 Ops + Coexistência com Mobile

**Data:** 2026-06-18
**Stack web:** Next.js 16.2.7 + React 19.2.4 + TypeScript 5 + Tailwind 4 + Firebase 12.14
**Projeto Firebase:** `canil-gcm` (mesmo do mobile)
**Hosting:** Firebase Hosting com frameworks backend (SSR) na região `southamerica-east1`
**Escopo:** análise estática do código em `C:\Projetos\k9-ops`. Nenhum arquivo foi alterado.

---

## TL;DR — Veredito

O painel web está em **estado significativamente mais maduro** que apps típicos em pré-lançamento. Arquitetura limpa, TypeScript estrito de verdade (zero `any`), zero `@ts-ignore`, zero secrets hardcoded, fluxo de admin via Cloud Functions callable.

**Mas existe um conjunto de problemas de coexistência com o mobile que precisa ser resolvido antes do go-live:**

1. 🔴 **`firestore.rules` está duplicado** entre os dois projetos com versões ligeiramente diferentes — quem deployar por último sobrescreve o outro.
2. 🔴 **`storage.rules` não está versionado no web** — só no mobile. Web não tem como deployar regras de storage.
3. 🟠 **Mismatch de domínio de auth**: web só aceita `@gcm.com.br`; rules aceitam `@gcm.com.br` E `@canilgcm.com`. Mobile usa só `@gcm.com.br`. Decidir qual é canônico.
4. 🟠 **`appendAuditTrail` no web usa `arrayUnion`** — pode violar `appendsInlineAuditOnUpdate` das rules em casos de retry (entries idênticos viram no-op).
5. 🟡 **Cobertura de testes muito baixa** (3 arquivos em todo o projeto).
6. 🟡 **Sem error boundary global telemetrado** — só `app/(app)/error.tsx` com `console.error`.

Nenhum dos itens 1-4 quebra o app hoje (porque está rodando), mas qualquer um deles **pode** quebrar a coexistência com o mobile no momento errado.

---

## 1. PERFIL DO PROJETO

| Item | Valor |
|------|-------|
| Framework | Next.js 16 App Router |
| React | 19.2 |
| Estilo | Tailwind CSS 4 (lightningcss) + `class-variance-authority` + `tailwind-merge` |
| State management | Context API próprio (AuthProvider, AccessControlProvider, DashboardPeriodProvider) + hooks por feature |
| Firebase client | SDK web 12.14, modular |
| Charts | `recharts` (com wrapper `lazy-recharts.tsx`) |
| Tabelas | `@tanstack/react-table` v8 |
| PDF | `jspdf` + `jspdf-autotable` |
| Excel | `xlsx` |
| Ícones | `lucide-react` |
| Datas | `date-fns` v4 |
| Testes | Vitest + Testing Library + jsdom |
| Lint | ESLint 9 com `eslint-config-next` (core-web-vitals + typescript) |
| Linguagem | TypeScript `strict: true` |
| Node engine | 22 |
| Estrutura | `src/app/(app)` autenticado + `src/app/(auth)` login + `src/features/{name}` |

### Features mapeadas
`auth · access · dashboard · effective (humans, k9, binomials, vehicles) · health · inventory · operations (occurrences) · reports · shifts · training · training-curriculums`

Cobre essencialmente todos os módulos administrativos sobre os dados que o mobile produz.

---

## 2. ARQUITETURA E QUALIDADE — Pontos fortes

### 🟢 TypeScript estrito de verdade
- `tsconfig.json` com `strict: true`, `noEmit`, `isolatedModules`
- **Zero ocorrências de `any` em `src/`** (grep direto)
- **Zero `@ts-ignore`, `@ts-expect-error` ou `@ts-nocheck`**

Isso é raríssimo. Mostra disciplina.

### 🟢 Logging mínimo
- Apenas 3 `console.*` em todo o `src/` (1 em `error.tsx` com `eslint-disable` proposital, 2 em `export-toolbar.tsx`)
- Nada que vaze dados sensíveis para o console em produção

### 🟢 Arquitetura clara
- `(app)` agrupado com `dynamic = "force-dynamic"` no layout — impede prerender estático de páginas que dependem de Firebase em runtime. Decisão correta para um console autenticado SPA.
- `AuthGate` separado do `AccessControlProvider` — bom separation of concerns.
- Cada feature tem suas próprias pastas: `components/`, `data/`, `hooks/`, `providers/`.
- Reutilização: `src/components/ui/` (Button, Badge, Card, Input, Label, Dialog).

### 🟢 Cloud Functions callable para admin
O arquivo `src/lib/firebase/functions.ts` tem **23+ funções callable** tipadas (`callAdminUpsertHuman`, `callAdminUpsertK9`, `callAdminCreateHealthEvent`, `callAdminCreateInventoryMovement`, etc.). Operações sensíveis (criar/arquivar humano, criar dog, atualizar role de instrutor) **não** são feitas com escrita direta no Firestore — passam por Function. Isso é o padrão certo. Permite validação server-side, auditoria estruturada, e checagem de permissão antes de tocar o Firestore.

### 🟢 Login flow correto
- `signInWithRa` normaliza RA, monta email, escolhe persistência (local vs session) baseado em "manter conectado"
- `sendPasswordResetForRa` existe — o mobile não tem isso
- `getAuthErrorMessage` traduz códigos pra pt-BR
- `sanitizeNextPath` impede open redirect (`if (!path.startsWith("/") || path.startsWith("//"))`)

### 🟢 next.config.ts
- `images.remotePatterns` whitelist correto: só `firebasestorage.googleapis.com`, `*.firebasestorage.app`, `storage.googleapis.com`, `lh3.googleusercontent.com`
- Sem `unoptimized: true` ou `dangerouslyAllowSVG`

### 🟢 .gitignore robusto
Cobre `.env*`, `service-account*.json`, `*-firebase-admin*.json`, `*.pem`, `.firebase/`, `temp/`. Tudo certo.

---

## 3. COEXISTÊNCIA COM MOBILE — Achados críticos

### 🔴 1. `firestore.rules` duplicado entre projetos

Há **duas cópias** do `firestore.rules`:
- `C:\Projetos\canil_gcm_mobile_chatgpt\canil-gcm\firestore.rules` (1930 linhas não-vazias)
- `C:\Projetos\k9-ops\firestore.rules` (1804 linhas não-vazias)

Os arquivos **não são idênticos** (diferença de ~126 linhas, ambos com o mesmo `match /{document=**} { allow read, write: if false; }` final).

**Risco:** qualquer `firebase deploy --only firestore:rules` rodado de um dos projetos **sobrescreve** o que o outro projeto tem. Se um dev abrir o repositório do web e fizer ajuste numa rule, ao deployar pode reverter um trecho que o mobile precisa. E vice-versa.

**Como descobri:** mesma assinatura inicial (`signedIn()`, `claimListHas()`, `hasRole()` idênticas), mesmo final (`match /notifications/{userId}/items/{notificationId}`, fallback `if false`), mas tamanhos diferentes — provavelmente uma das versões foi atualizada num lado e não sincronizada.

**Solução:**
- Eleger UMA fonte da verdade (sugiro `k9-ops/firestore.rules` por ser o repo público/admin)
- Apagar a cópia do outro projeto
- Adicionar um symlink, submodule, ou um simples `predeploy` script no projeto que ficar sem o arquivo, que copia da fonte
- OU promover as rules para um repositório `canil-gcm-firebase` separado e versionado

### 🔴 2. `storage.rules` não está no projeto web

`firebase.json` do mobile declara `storage.rules`. `firebase.json` do web declara **apenas** firestore + functions + hosting. Não há `storage.rules` em `C:\Projetos\k9-ops`.

**Risco:** se o deploy do mobile cair ou for descontinuado, ninguém deployará `storage.rules`. Pior: se alguém deployar `firebase deploy` (sem `--only`) do web, o storage continuará com o estado anterior (talvez mais permissivo, talvez mais restritivo) e ninguém perceberá.

**Solução:** copiar `storage.rules` para `k9-ops/` e adicionar no `firebase.json`:
```json
{
  "storage": { "rules": "storage.rules" }
}
```
ou centralizar (item 1).

### 🟠 3. Mismatch de domínio de auth

| Lugar | Domínio aceito |
|-------|----------------|
| Mobile `auth_service.dart` | só `@gcm.com.br` |
| Web `auth-service.ts` | só `@gcm.com.br` |
| `firestore.rules` `emailMatchesRa()` | `@gcm.com.br` **OU** `@canilgcm.com` |

Quem está fora do esperado é a **rules**, não os clients. Isso **não bloqueia** ninguém hoje (`emailMatchesRa` faz `||`), mas:
- Sugere que houve uma migração em algum momento de `canilgcm.com` para `gcm.com.br`
- Algum usuário antigo cadastrado com `@canilgcm.com` ainda passaria nas rules mas não conseguiria logar nem no mobile nem no web
- Pode haver dados órfãos vinculados a esse domínio

**Solução:** rodar uma query rápida no console Firebase Auth procurando usuários com `@canilgcm.com`. Se não houver, simplificar a rule pra apenas `@gcm.com.br`.

### 🟠 4. `arrayUnion` no audit_trail do web

`src/features/effective/data/human-management-service.ts:42`:
```typescript
async function appendAuditTrail(userRa: string, entry: ...) {
  const ref = doc(db, "users", userRa);
  await updateDoc(ref, {
    audit_trail: arrayUnion({ ...entry, performed_at: Timestamp.now() }),
    updated_at: Timestamp.now(),
  });
}
```

**Problema:** `arrayUnion` não duplica entradas idênticas. Mas a rule `appendsInlineAuditOnUpdate()` exige:
```
request.resource.data.audit_trail.size() > previousAudit.size()
```

Em 99% dos casos isso funciona porque `performed_at: Timestamp.now()` torna cada entry único. **Mas** se duas chamadas concorrentes calcularem `Timestamp.now()` no mesmo milissegundo com o mesmo `action`/`actor_ra`/`details`, o `arrayUnion` colapsa as duas e o write é negado pela rule.

Improvável na prática (6 usuários, ações esparsas), mas é uma bomba relógio. Risco real quando o sistema escalar.

**Solução:** trocar `arrayUnion` por leitura do snapshot, append manual e `updateDoc({ audit_trail: [...previous, entry] })`. Isso garante size aumenta sempre. O serviço de currículos (`training-curriculum-service.ts:97`) já faz assim (`appendAudit` lê o snapshot anterior). Padronizar.

### 🟡 5. Schemas implícitos divergentes (low risk)

`UserMirror` no web (`auth-provider.tsx:31`) tem campos em camelCase **E** snake_case (`access_profile`/`accessProfile`, `image_url`/`imageUrl`, etc.). O código resolve via fallback (`firstStringValue(...)`), o que sugere que dados antigos foram migrados sem normalização e os dois formatos coexistem.

**Risco:** se o mobile escrever só `accessProfileId` e o web só ler `access_profile_id`, ou vice-versa, dados podem desaparecer. Hoje está tudo coberto por fallbacks, mas qualquer feature nova precisa lembrar de escrever AMBOS os campos.

**Solução:** rodar uma migração one-shot normalizando para uma convenção. Documentar a convenção em algum lugar (provavelmente `AGENTS.md` ou um `SCHEMA.md` compartilhado entre os dois repos).

### 🟢 Coexistência que ESTÁ funcionando bem

Listei só pra dar tranquilidade:

| Item | Status |
|------|--------|
| Mesmo `projectId` (`canil-gcm`) | ✅ |
| Web lê das collections que o mobile escreve (`occurrences`, `dogs`, `users`, `vehicles`, `shift_logs`, `active_shifts`, `notifications/{ra}/items`, `auditLogs`, `effective_movements`, `trainings`, `training_sessions`, `promotion_requests`, `documentos`) | ✅ |
| Mesma estrutura `notifications/{userId}/items/{notificationId}` | ✅ |
| Mesma região de Cloud Functions (`southamerica-east1`) | ✅ |
| Web usa CFs callable para mutações sensíveis (admin* funcs) | ✅ |
| Web tem `AccessControlProvider` espelhado das rules | ✅ |
| Web normaliza `access_profile_id` via `normalizeAccessProfile` (consistente com `currentAccessProfileId` das rules) | ✅ |

---

## 4. QUALIDADE DE CÓDIGO — Achados específicos

### 🟢 Bem feito

- `tsconfig.json` strict, sem nenhuma flag relaxada
- `next.config.ts` minimalista e sem `dangerously*`
- ESLint com `eslint-config-next/core-web-vitals` + `typescript`
- ignore explícito de `functions/**` e `tools/**` do lint (esses têm regras próprias)
- Tipos detalhados em todas as callable functions (`Result` e `Payload`)
- Páginas `loading.tsx` e `error.tsx` por route group
- Header com `<html lang="pt-BR">` e classe antialiased
- Páginas server-side (`page.tsx`) só importam componentes client, sem prop drilling absurdo

### 🟡 Pontos a melhorar

- **Testes:** apenas 3 arquivos de teste em `src/`:
  - `src/lib/__tests__/access-control.test.ts`
  - `src/lib/__tests__/parsing.test.ts`
  - `src/features/dashboard/lib/__tests__/dashboard-utils.test.ts`

  Para um painel admin com fluxos de auditoria, isso é pouco. Faltam testes de:
  - Hooks de dados (`use-effective-data`, `use-training-data`, etc.) com mocks de Firestore
  - Lógica de `appendAuditTrail`, `currentActorInfo` etc.
  - Forms críticos (k9-admin-form, human-admin-form)

- **`error.tsx` só faz `console.error`:** não há integração com Sentry / Firebase Crashlytics. Em produção, erros do painel ficam invisíveis a menos que o admin reporte.

- **Page-by-page bundle:** o projeto declara `dynamic = "force-dynamic"` no layout `(app)`, garantindo SSR fresca a cada request. Combinado com SDK web do Firebase no client, isso é tecnicamente ok, mas perde os benefícios de cache do Next 16. Avaliar quais páginas (listagens, dashboards) poderiam ter `revalidate` ou Server Components puros.

- **Pasta `.firebase/` deployada com node_modules:** existe `.firebase/canil-gcm/functions/` com node_modules congelados — provavelmente artefato do deploy frameworks backend, mas ocupa espaço e confunde Glob. Está no `.gitignore` (`.firebase/`), o que é bom. Verificar que isso não está sendo commitado.

- **Worktrees `.claude/worktrees/` espalhadas:** ~5 worktrees com cópias completas do projeto. Mesmo problema do mobile. Adicionar `.claude/worktrees/` no `.gitignore`. (Verifiquei: **não está** no `.gitignore`, embora `.firebase/` esteja.)

### 🟡 Imports com caracteres unicode em `k9-admin-service.ts`

`import { canônicalK9Modalities, canônicalModality, ... }` — variáveis e funções com `ô`. Funciona, mas é incomum, dificulta busca por símbolo no editor, e pode dar dor de cabeça em terminais sem UTF-8. Renomear para `canonicalK9Modalities` quando refatorar.

---

## 5. SEGURANÇA — Análise por categoria

### 🟢 Secrets
- Zero AIza/sk-/pk_live hardcoded em `src/`
- Firebase config inteiramente via `process.env.NEXT_PUBLIC_*`
- `.env.local` ignorado, `.env.local.example` versionado com placeholders
- `service-account*.json` ignorado

### 🟢 Auth/AuthZ no client
- `AuthGate` redireciona unauthenticated com `next` preservado
- `sanitizeNextPath` impede open redirect
- `AccessControlProvider` busca perfil ativo via `onSnapshot`, com fallback local
- `applyK9InstructorCapability` aplica claim de instrutor por cima do perfil base

Importante notar que a segurança real está nas **rules** do Firestore + nas **Cloud Functions callable** (que verificam claims server-side). O `AccessControlProvider` é apenas UX (esconder botões, etc.) — se alguém burlasse o client, ainda bateria nas rules.

### 🟡 Defesa em profundidade
- O `error.tsx` do `(app)` faz `window.location.href = "/dashboard"` direto, em vez de `router.push` — em alguns ambientes (PWAs) isso pode forçar full reload desnecessário. Trocar por `router.push(paths.dashboard)`.
- Não vi CSP (`Content-Security-Policy`) configurado no `next.config.ts`. Não é bloqueador para um console interno, mas é boa prática.

### 🟢 Functions callable verificam server-side
As callable em `lib/firebase/functions.ts` retornam tipadas e o SDK valida `context.auth.token` automaticamente. As Functions ler `claims.ra`, `claims.admin`, etc. (isso eu não pude validar diretamente porque o `src/index.ts` das functions do mobile não está acessível, mas o padrão está correto).

---

## 6. PERFORMANCE / BUNDLE

- `lazy-recharts.tsx` indica que recharts está sendo lazy-loaded — bom
- `xlsx@0.18.5` é grande (~500KB) — só importar em páginas de export
- `jspdf` + `jspdf-autotable` idem
- `firebase@^12.14.0` na home page: garantir que `firebase/auth`, `firebase/firestore`, `firebase/functions`, `firebase/storage` sejam importados modularmente — verificado, está modular
- App Router + `dynamic = "force-dynamic"` evita prerender, mas significa que toda navegação SSR-aware tem custo. Avaliar `revalidate: 60` em páginas de listagem que mudam pouco

Não dá pra medir bundle sem rodar `next build --turbopack` num ambiente. Sugiro fazer e olhar o output.

---

## 7. DEPLOY E AMBIENTE

| Item | Valor |
|------|-------|
| `.firebaserc` | `{ "projects": { "default": "canil-gcm" } }` ✅ |
| `firebase.json` hosting | `site: "canil-gcm"` com `frameworksBackend.region: "southamerica-east1"` ✅ |
| `firebase.json` functions | `{ source: "functions", codebase: "shift-reminders", runtime: "nodejs22" }` ✅ |
| Functions deploy | `npm run deploy` (`firebase deploy --only functions`) |
| Web deploy | implícito via `firebase deploy --only hosting` (frameworks backend faz `next build`) |
| Engines node 22 | consistente entre raiz e functions ✅ |

### 🟡 `functions` do web não tem build artifact versionado
- `functions/package.json` declara `main: "lib/index.js"` mas `lib/` não existe na pasta — `tsc` é rodado no deploy
- Sem `dist/` ou `lib/` versionado, OK (esperado, está no `.gitignore` provavelmente)

### 🟡 Single function codebase `shift-reminders`
A Cloud Function de scheduling de lembretes de turno. Não conflita com o mobile (que tem outras Functions na pasta `functions/` dele).

**Verificar:** os DOIS projetos podem deployar Functions ao mesmo projectId? Sim, desde que usem `codebase` diferente no `firebase.json` (e usam: `shift-reminders` no web; o mobile não declara codebase, então usa o default). Isso é correto, mas vale documentar.

---

## 8. CHECKLIST CRUZADO — Mobile ↔ Web

| # | Pendência | Onde resolver |
|---|-----------|---------------|
| 1 | Eleger um lugar canônico para `firestore.rules` e `storage.rules`. Eliminar a duplicação. | Decisão arquitetural, depois execução nos dois repos |
| 2 | Garantir que `firebase.json` do web declare `storage.rules` (após resolver #1) | `k9-ops/firebase.json` |
| 3 | Decidir se `@canilgcm.com` ainda é válido. Simplificar `emailMatchesRa()` nas rules se não for | Rules + checar Auth |
| 4 | Substituir `arrayUnion` em `appendAuditTrail` (`human-management-service.ts`) por leitura + push para garantir size++ | `src/features/effective/data/human-management-service.ts` |
| 5 | Normalizar campos snake_case vs camelCase no `users/{ra}`. Documentar convenção. | Migração one-shot via `tools/` (mobile já tem `tools/backfill_notification_resolution.js` como modelo) |
| 6 | Adicionar `.claude/worktrees/` ao `.gitignore` do web | `k9-ops/.gitignore` |
| 7 | Adicionar Sentry ou Firebase Crashlytics no web (web não tem Crashlytics, e mobile também não — somar à mesma rodada) | Ambos repos |
| 8 | Aumentar cobertura de testes do web (mínimo: services + hooks críticos) | `k9-ops/src/**/__tests__/` |
| 9 | Documentar no `AGENTS.md` (ambos os repos) o contrato compartilhado: collections, formato de email, campos snake/camel | `AGENTS.md` em ambos |
| 10 | Validar que claims customizadas (`ra`, `admin`, `role`, `roles`, `access_profile_id`, `mobile_access`, `web_access`) estão sendo escritas pela Function correta no momento de criar/editar usuário | `functions/` do mobile + integração com `callAdminUpsertHuman` |

---

## 9. CONCLUSÃO

O painel web **está pronto para uso interno** — provavelmente já está em uso. A qualidade do código TypeScript/React é melhor que o típico (zero `any`, zero `@ts-ignore`, lint estrito), e o uso de Cloud Functions para mutações administrativas é a abordagem correta.

**O problema não está dentro do web — está na interface entre web e mobile:**

1. Os arquivos de `firestore.rules` (e `storage.rules` ausente no web) precisam ser unificados, **agora**, antes que mais uma feature seja adicionada num dos lados e crie divergência permanente.
2. A convenção de campos `users/{ra}` (snake vs camel) precisa ser documentada e padronizada.
3. O `arrayUnion` no audit trail do web é uma bomba relógio — trocar quando puder.

Nenhum desses itens precisa interromper o lançamento do mobile sideload. Mas sem resolver #1 e #2, **vocês vão pagar caro** quando alguém fizer um deploy de rules sem perceber que estava na versão errada do arquivo.

**Sugestão de ordem:**
1. (1 dia) Unificar rules — escolher fonte da verdade, apagar a cópia, criar mecanismo de sync ou repo dedicado
2. (1 dia) Adicionar Crashlytics/Sentry em ambos
3. (2 dias) Migração one-shot normalizando `users/{ra}` e documentar contrato em `AGENTS.md`
4. (contínuo) Cobertura de testes do web

---

*Relatório gerado por análise estática em 18/06/2026. Nenhum arquivo foi alterado.*
