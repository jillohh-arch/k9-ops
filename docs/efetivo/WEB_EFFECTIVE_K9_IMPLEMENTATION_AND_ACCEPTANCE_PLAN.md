# K9 Ops Web — Plano de Implementação e Aceite do Redesign Efetivo K9

| Campo | Valor |
|---|---|
| Status | IMPLEMENTADO / VALIDADO / APROVADO VISUALMENTE |
| Data | 2026-08-14 |
| Dependências | Auditoria + Navigation Contract + Redesign Spec aprovados |
| Referência visual | `WEB_EFFECTIVE_K9_APPROVED_MOCKUP.png` |

---

# 1. Princípio de execução

A implementação será incremental.

Ordem:

```text
Preflight
↓
Revalidar baseline local
↓
Navegação Efetivo
↓
Estrutura nova do K9
↓
Agrupamentos e filtros
↓
Cards
↓
Drawer
↓
Integração de dados on-demand
↓
Testes
↓
Build
↓
Inspeção visual
↓
Refinamento
↓
Documentação final
```

Nenhum commit/push/deploy deve ser incluído automaticamente no primeiro prompt de implementação.

---

# 2. Preflight obrigatório

Antes de editar:

- branch atual;
- HEAD;
- upstream;
- `git status --short`;
- staged/untracked;
- ahead/behind;
- confirmar que o workspace correto é o Web;
- confirmar os paths auditados;
- comparar `effective/page.tsx`, `k9/page.tsx`, `app-shell.tsx`, `paths.ts` com esta documentação;
- parar se houver drift estrutural relevante.

---

# 3. Fase A — Navegação

Objetivos:

- transformar Efetivo em grupo expansível;
- preservar permissões;
- adicionar 4 subitens;
- autoexpandir quando rota filha estiver ativa;
- preservar mobile;
- compatibilidade `/effective`.

Arquivos candidatos:

- `src/components/layout/app-shell.tsx`
- `src/app/(app)/effective/page.tsx`
- eventualmente `src/lib/routes/paths.ts` somente se necessário.

Preferência:

- reutilizar as rotas existentes;
- não criar `/effective/k9`.

---

# 4. Fase B — Estrutura da tela K9

Objetivos:

- header compacto;
- CTA atual preservado;
- 4 cards-resumo;
- nova barra de filtros;
- remover paginação global;
- criar seções por grupo.

Arquivo principal:

- `src/app/(app)/k9/page.tsx`

Componentes compartilhados só devem ser alterados quando a mudança também for segura para Humanos/Binômios/Viaturas.

Se o redesign do K9 exigir componente muito específico, criar componente K9 dedicado em vez de quebrar `effective-ui.tsx`.

---

# 5. Fase C — Classificação

Criar função pura testável para classificar o K9.

Entrada mínima:

- status administrativo;
- especialidades;
- readiness canônica opcional.

Saída sugerida:

```ts
type K9RosterGroup =
  | "ready"
  | "formation"
  | "unavailable"
  | "unclassified_active";
```

A função não deve inferir readiness clínica quando o dado estiver ausente.

---

# 6. Fase D — Drawer

Criar componente dedicado.

Sugestão de path:

```text
src/features/effective/components/k9-roster/k9-detail-drawer.tsx
```

e componentes próximos:

```text
k9-roster-card.tsx
k9-roster-section.tsx
k9-roster-summary.tsx
k9-roster-filters.tsx
```

Evitar arquivo monolítico.

---

# 7. Dados do drawer

Preferir hook dedicado e mínimo, por exemplo:

```text
use-k9-roster-detail.ts
```

Ele pode compor fontes já existentes.

Regra:

- assinar somente o K9 selecionado;
- cancelar listeners ao trocar/fechar seleção;
- não carregar Health/Training detalhado para todos os cards;
- cada fonte deve falhar de forma localizada quando possível.

---

# 8. Readiness

Antes de integrar:

- confirmar a fonte Health v1 existente na branch local;
- confirmar contrato e permissões;
- confirmar labels;
- não usar percentuais legados.

Se o contrato Health ainda não estiver disponível na branch:

- implementar drawer com estado `Não disponível`;
- deixar integração Health para fase específica;
- não criar um substituto temporário enganoso.

---

# 9. Testes mínimos

## Navegação

- Efetivo expand/recolhe;
- Efetivo autoexpande em `/k9`;
- filho correto ativo;
- permissões ocultam filhos proibidos;
- `/effective` resolve child permitido;
- mobile fecha após navegação.

## Classificação

Cobrir:

- K9 inativo;
- operational specialty;
- formation specialty;
- ativo sem especialidade;
- health temporarily_unfit;
- health fit_with_restrictions;
- readiness ausente.

## Filtros

- busca;
- status;
- especialidade;
- operador;
- combinação de filtros;
- limpar filtros.

## Drawer

- abre no card;
- fecha no X;
- fecha com Escape em modo overlay;
- seleção troca dados;
- ausência de foto;
- ausência de binômio;
- erro localizado;
- loading localizado;
- atalhos respeitam disponibilidade.

## Permissão

- `Cadastrar K9` só aparece com `k9/create`.

---

# 10. Regressão obrigatória

Executar os scripts definidos pelo projeto:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Separar:

- regressões novas;
- findings preexistentes.

Nenhuma falha nova pode ser promovida como "preexistente" sem prova.

---

# 11. Inspeção visual

Após build/testes:

Validar no browser pelo menos:

- 1920x1080;
- 1440x900;
- 1280x800;
- viewport tablet;
- viewport mobile.

Comparar com o mockup:

- hierarquia;
- sidebar;
- densidade;
- cards;
- espaçamento;
- drawer;
- cores semânticas;
- estados vazios;
- overflow;
- textos longos;
- K9 sem foto;
- K9 sem operador.

---

# 12. Invariantes de segurança

Durante o redesign:

- zero deploy;
- zero alteração de Rules;
- zero alteração de índices;
- zero Cloud Function nova;
- zero write de migração;
- zero alteração de schema só para satisfazer UI;
- zero dado mockado em produção;
- zero permissão ampliada;
- zero alteração no Dashboard.

---

# 13. Gate de conclusão

A fase Efetivo K9 só pode ser declarada concluída quando:

- navegação aprovada;
- mockup reproduzido com fidelidade suficiente;
- sem cards dos 4 núcleos na tela principal;
- filtros funcionais;
- todos os K9 visíveis em algum grupo;
- drawer funcional;
- dados ausentes degradam corretamente;
- prontidão não é inferida de especialidades;
- testes verdes;
- typecheck verde;
- lint sem regressão;
- build verde;
- inspeção visual aprovada;
- documentação atualizada.

---

# 14. Próximas fases

Somente após aprovação do Efetivo K9:

```text
Efetivo Humano
↓
Binômios
↓
Viaturas
```

O Efetivo K9 passa a ser referência de:

- shell do submódulo;
- espaçamento;
- padrões de KPI;
- filtros;
- drawers;
- estados;
- responsividade;
- microinterações.

Cada módulo seguinte deve adaptar o domínio, não copiar cegamente os mesmos dados e métricas.
