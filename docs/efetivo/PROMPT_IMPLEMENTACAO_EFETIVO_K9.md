# PROMPT — IMPLEMENTAÇÃO CONTROLADA DO REDESIGN “EFETIVO K9” — K9 OPS WEB

Estamos iniciando a implementação controlada do redesign aprovado de **Efetivo K9** no K9 Ops Web.

A implementação deve seguir o mockup aprovado e os contratos documentais já definidos, sem alterar backend, regras, índices, Functions, schema ou Dashboard.

A execução desta rodada deve terminar com o código **implementado e validado localmente**, porém **SEM commit, SEM push e SEM deploy**.

---

# 0. PRINCÍPIO DA RODADA

Objetivo:

- transformar `Efetivo` em grupo expansível na sidebar;
- promover `Efetivo K9`, `Efetivo Humano`, `Binômios` e `Viaturas` a subitens;
- remover os 4 núcleos/cards da tela principal de `/effective`;
- fazer `/k9` se tornar a experiência principal do Efetivo K9;
- reproduzir o mockup visual aprovado;
- manter a linguagem visual do Dashboard;
- preservar regras de negócio e permissões;
- criar drawer lateral de detalhes do K9 com carregamento on-demand;
- manter degradação segura quando um dado do mockup não existir.

NÃO fazer nesta rodada:

- `git commit`;
- `git push`;
- deploy Firebase/Vercel/Hosting/Functions;
- alteração de `firestore.rules`;
- alteração de `firestore.indexes.json`;
- alteração de Cloud Functions;
- migração ou escrita administrativa em Firestore;
- alteração de schema só para atender UI;
- redesign de Efetivo Humano, Binômios ou Viaturas;
- redesign do Dashboard;
- introdução de score/readiness alternativo;
- uso de dados fictícios em produção.

---

# 1. REPOSITÓRIO E PREFLIGHT

Repositório esperado:

```text
C:\Projetos\k9-ops
```

Antes de qualquer edição, execute e reporte integralmente:

```powershell
git -C "C:\Projetos\k9-ops" status --short
git -C "C:\Projetos\k9-ops" branch --show-current
git -C "C:\Projetos\k9-ops" rev-parse HEAD
git -C "C:\Projetos\k9-ops" remote -v
git -C "C:\Projetos\k9-ops" branch -vv
git -C "C:\Projetos\k9-ops" rev-list --left-right --count @{upstream}...HEAD
```

Se não houver upstream configurado, apenas registre.

IMPORTANTE:

- qualquer alteração local preexistente é trabalho legítimo;
- NÃO restaurar;
- NÃO apagar;
- NÃO mover;
- NÃO adicionar ao stage automaticamente;
- NÃO fazer stash;
- NÃO fazer clean;
- NÃO resetar;
- NÃO sobrescrever.

Registre uma baseline literal de `git status --short`.

---

# 2. CONFIRMAR DOCUMENTAÇÃO E MOCKUP

Localize, se já estiverem no workspace, os documentos de referência:

```text
WEB_EFFECTIVE_K9_BASELINE_AND_AUDIT.md
WEB_EFFECTIVE_NAVIGATION_CONTRACT.md
WEB_EFFECTIVE_K9_REDESIGN_SPEC.md
WEB_EFFECTIVE_K9_IMPLEMENTATION_AND_ACCEPTANCE_PLAN.md
WEB_EFFECTIVE_K9_APPROVED_MOCKUP.png
```

Podem estar sob `docs/`, `docs/ui/`, `docs/effective/` ou outro diretório informado pelo operador.

Se o mockup aprovado não estiver acessível nesta execução:

PARE antes de implementar o visual e reporte que a referência visual precisa ser disponibilizada.

Se os Markdown não estiverem no repositório, NÃO invente uma cópia incompleta. Use as especificações deste prompt como contrato desta rodada e registre a ausência como finding documental.

---

# 3. REAUDITORIA OBRIGATÓRIA DO ESTADO ATUAL

Antes de editar, abra e audite pelo menos:

```text
src/components/layout/app-shell.tsx
src/lib/routes/paths.ts
src/app/(app)/effective/page.tsx
src/app/(app)/k9/page.tsx
src/app/(app)/k9/[dogId]/page.tsx
src/features/effective/components/effective-ui.tsx
src/features/effective/hooks/use-effective-data.ts
src/features/effective/hooks/use-k9-profile-data.ts
src/features/effective/providers/entities-provider.tsx
src/features/effective/lib/k9-modalities.ts
src/features/access/providers/access-control-provider.tsx
src/lib/permissions/access-control.ts
```

Confirme objetivamente:

1. `/effective` ainda funciona como hub interno com K9/Humanos/Viaturas/Binômios;
2. `/k9`, `/humans`, `/binomials` e `/vehicles` continuam existindo;
3. `Efetivo` na sidebar ainda é um único item;
4. o shell continua reconhecendo as quatro rotas como pertencentes ao Efetivo;
5. `K9Page` ainda usa `useEffectiveData()`;
6. a classificação atual de K9 continua baseada em:
   - status administrativo;
   - especialidade `operational`;
   - especialidade `in_formation`;
7. `Cadastrar K9` continua condicionado a `can("k9", "create")`;
8. `useK9ProfileData()` ainda lê saúde/peso/treino/ocorrência/documentos.

Se houver drift estrutural relevante em qualquer um destes pontos:

PARE e reporte antes de editar.

---

# 4. FINDING PREEXISTENTE A PRESERVAR

Audite `subscribeCollection()` em:

```text
src/features/effective/hooks/use-effective-data.ts
```

A baseline conhecida montava uma variável `ref` com constraints, porém o listener usava `collection(db, path)` em vez de `ref`.

Se isso ainda existir:

- registre como finding preexistente;
- NÃO misture uma correção silenciosa com o redesign;
- só altere se a implementação realmente depender disso E se criar teste específico provando a correção;
- caso contrário, preserve para uma rodada técnica separada.

---

# 5. NAVEGAÇÃO — EFETIVO COMO GRUPO EXPANSÍVEL

Transformar `Efetivo` na sidebar em grupo expansível:

```text
Efetivo
├── Efetivo K9      → /k9
├── Efetivo Humano  → /humans
├── Binômios        → /binomials
└── Viaturas        → /vehicles
```

Regras:

- cada filho só aparece se o usuário puder visualizar o módulo correspondente;
- K9 → `can("k9", "view")`;
- Humanos → `can("humans", "view")`;
- Binômios → `can("binomials", "view")`;
- Viaturas → `can("vehicles", "view")`;
- o pai deve autoexpandir em qualquer rota filha;
- pai e filho ativo devem possuir estados visuais distintos;
- o filho deve ter destaque mais compacto;
- usar `aria-expanded`;
- navegação por teclado deve funcionar;
- no shell mobile, selecionar um filho deve fechar o menu;
- hover não pode ser requisito funcional.

Não criar novas rotas `/effective/k9`, `/effective/humans`, etc.

---

# 6. COMPATIBILIDADE DE `/effective`

A rota `/effective` não deve desaparecer.

Novo comportamento:

1. resolver os filhos permitidos;
2. se `k9/view` estiver permitido, redirecionar para `/k9`;
3. senão redirecionar para o primeiro filho permitido;
4. se nenhum núcleo estiver liberado, manter estado fail-closed de acesso/nenhum núcleo.

Remover da experiência normal de `/effective`:

- header “Gestão do efetivo operacional”;
- badge “4 núcleos”;
- 4 cards grandes K9/Humanos/Viaturas/Binômios;
- `activeTab` local;
- renderização interna das quatro páginas.

---

# 7. NOVA TELA `/k9` — ESTRUTURA GERAL

Implementar a composição aprovada:

```text
Efetivo K9
Visão operacional da matilha da unidade

[Efetivo total]
[Prontos para emprego]
[Em formação]
[Indisponíveis]

[Busca] [Status] [Emprego/Situação] [Especialidade] [Operador] [Grid/Lista]

PRONTOS PARA EMPREGO
[cards...]

EM FORMAÇÃO
[cards...]

INDISPONÍVEIS / COM RESTRIÇÕES
[cards...]

ATIVOS SEM CLASSIFICAÇÃO OPERACIONAL
[cards...]   ← apenas se necessário
```

O Dashboard, topbar e linguagem global não devem ser redesenhados.

---

# 8. HEADER DA TELA

Usar header compacto, próximo ao mockup aprovado:

```text
[ícone] Efetivo K9
        Visão operacional da matilha da unidade

                                     + Cadastrar K9
```

`Cadastrar K9`:

- preservar href atual;
- exibir apenas com `can("k9", "create")`;
- não criar botão “desabilitado” para usuário sem permissão.

---

# 9. CARDS DE RESUMO

Labels aprovadas:

```text
Efetivo total
Prontos para emprego
Em formação
Indisponíveis
```

IMPORTANTE:

A implementação NÃO pode simplesmente renomear a métrica atual “Operacionais” para “Prontos para emprego” se a semântica não fechar.

---

# 10. CONTRATO DE CLASSIFICAÇÃO

Criar uma função pura e testável de classificação.

Sugestão:

```ts
type K9RosterGroup =
  | "ready"
  | "formation"
  | "unavailable"
  | "unclassified_active";
```

A classificação pode receber:

```text
status administrativo
especialidades
readiness Health opcional
```

Precedência:

```text
1. indisponível administrativo / temporarily_unfit
2. em formação sem prontidão para emprego
3. pronto para emprego
4. ativo sem classificação operacional
```

REGRAS CRÍTICAS:

- especialidade `operational` NÃO é sinônimo de prontidão clínica;
- `temporarily_unfit` é bloqueante;
- `fit_with_restrictions` não deve ser tratado automaticamente como indisponível total;
- `operational_attention` não deve ser tratado automaticamente como indisponível;
- ausência de readiness NÃO deve ser interpretada como “Operational”;
- nenhum K9 pode desaparecer por não se encaixar no mockup nominal.

Se a readiness Health canônica não estiver disponível nesta branch:

- classifique com os dados administrativos/formação já existentes;
- NÃO invente readiness;
- o drawer deve mostrar readiness indisponível;
- registre a integração Health como pendente, sem bloquear o redesign visual base.

---

# 11. GRUPO FALLBACK

Se um K9 estiver ativo, porém:

- não tiver especialidade operacional;
- não tiver especialidade em formação;
- não estiver administrativamente indisponível;

ele deve aparecer em:

```text
ATIVOS SEM CLASSIFICAÇÃO OPERACIONAL
```

Essa seção só aparece quando houver registros.

Nunca ocultar um K9 para manter fidelidade visual ao mockup.

---

# 12. FILTROS

Preservar no mínimo:

- busca por nome;
- matrícula;
- raça;
- operador;
- status;
- especialidade;
- operador;
- grid/lista.

Adicionar filtro de emprego/situação somente se houver semântica real.

Fluxo:

```text
dados base
→ filtros
→ classificação
→ grupos
→ renderização
```

Não paginar 6 itens globalmente como hoje.

---

# 13. PAGINAÇÃO

Remover a paginação global de 6 registros da nova experiência K9.

Renderizar todos os resultados filtrados agrupados.

Não adicionar carrossel/setas decorativas sem função real.

Se houver overflow horizontal real em algum breakpoint, implementar apenas com justificativa e acessibilidade.

---

# 14. CARD DO K9

O card deve ficar mais compacto e operacional.

Conteúdo mínimo:

- foto;
- nome;
- status textual;
- raça;
- operador/condutor;
- especialidades principais;
- indicação semântica de estado.

Limitar especialidades visíveis a 2 ou 3 e usar overflow do tipo `+N` se necessário.

Não colocar no card:

- histórico clínico detalhado;
- peso;
- documentos;
- agenda;
- timeline;
- prontidão detalhada.

Esses itens pertencem ao drawer/perfil.

---

# 15. SELEÇÃO

Ao clicar no card:

```text
selectedDogId = dog.id
```

Comportamento:

- card recebe seleção cyan discreta;
- drawer abre;
- drawer carrega dados adicionais sob demanda;
- clicar em outro K9 troca a seleção;
- fechar limpa a seleção;
- card deve ser acionável por teclado.

---

# 16. DRAWER LATERAL — DESKTOP

No desktop amplo:

- drawer em coluna lateral direita;
- sticky;
- não cobre sidebar;
- não cobre topbar;
- largura aproximada entre 380–430 px;
- roster reduz largura quando drawer está aberto;
- rolagem interna se necessário.

Não copiar o mockup cegamente se isso quebrar o shell real; preservar os tokens e dimensões do K9 Ops atual.

---

# 17. DRAWER — TABLET/MOBILE

Em viewport mais estreito:

- transformar em sheet/modal lateral;
- overlay;
- botão fechar;
- Escape fecha;
- foco deve permanecer controlado;
- sem interação dependente de hover.

---

# 18. CONTEÚDO DO DRAWER

## 18.1 Identificação

Exibir quando disponível:

- status;
- nome;
- raça;
- foto;
- matrícula;
- nascimento/idade;
- sexo;
- cor;
- microchip.

Dado ausente:

```text
Não informado
```

Nunca inventar.

## 18.2 Binômio atual

Resolver vínculo real.

Exibir quando houver:

- foto do condutor;
- nome de guerra;
- RA;
- função;
- vínculo desde;
- situação de turno.

Sem vínculo:

```text
Sem binômio ativo
```

Não inferir “ativo no turno” só por existir condutor cadastrado.

## 18.3 Especialidades

Usar as especialidades canônicas existentes.

Não inferir modalidade a partir de uma sessão de treino isolada.

## 18.4 Resumo de prontidão

Fonte preferencial, se disponível e já autorizada:

```text
dogs/{dogId}/health_summary/current
```

Usar exatamente os estados oficiais Health:

```text
operational
operational_attention
fit_with_restrictions
temporarily_unfit
not_evaluated
```

Não exibir score percentual inventado.

Se a fonte não estiver disponível:

```text
Prontidão não disponível
```

ou equivalente visual discreto.

NÃO usar `readinessScore` de Binômios como substituto.

## 18.5 Última atividade

Carregar sob demanda.

Escopo inicial:

- última sessão de treinamento válida.

Não misturar treino + ocorrência + turno em um conceito genérico de “atividade” sem documentar uma regra adicional.

## 18.6 Próxima agenda / saúde

Usar fonte Health canônica somente se ela já existir na branch e puder ser lida corretamente.

Se não estiver disponível:

- ocultar o bloco; OU
- mostrar estado vazio verdadeiro.

Nunca inventar vacina/data/consulta do mockup.

---

# 19. AÇÕES DO DRAWER

Ações aprovadas:

```text
Ver perfil
Abrir prontuário
Ver binômio
```

## Ver perfil

Usar:

```text
/k9/{dogId}
```

## Abrir prontuário

Antes de implementar, auditar se já existe deeplink/rota real para área Health do perfil.

Se não existir:

- NÃO criar rota fictícia;
- usar o destino canônico existente mais próximo apenas se semanticamente correto;
- se não houver destino seguro, ocultar/desabilitar a ação e registrar finding.

## Ver binômio

Somente se o binômio puder ser resolvido.

Sem vínculo:

- ocultar ou desabilitar com clareza.

---

# 20. ESTRATÉGIA DE DADOS

Cards:

- continuar baseados no hook enxuto de Efetivo.

Drawer:

- criar hook dedicado on-demand, preferencialmente algo como:

```text
src/features/effective/hooks/use-k9-roster-detail.ts
```

ou equivalente.

Não abrir listeners Health/Training/Documentos para TODOS os cães só para preencher o roster.

Listeners do detalhe devem existir apenas enquanto houver `selectedDogId`.

Ao trocar/fechar seleção:

- unsubscribe corretamente;
- não deixar listeners órfãos.

---

# 21. ARQUITETURA DE COMPONENTES

Evitar transformar `src/app/(app)/k9/page.tsx` em um arquivo monolítico ainda maior.

Preferência por componentes locais de roster, por exemplo:

```text
src/features/effective/components/k9-roster/
  k9-roster-card.tsx
  k9-roster-section.tsx
  k9-roster-summary.tsx
  k9-roster-filters.tsx
  k9-detail-drawer.tsx
```

Nomes podem variar.

Regra:

- componente específico de K9 não deve ser empurrado para `effective-ui.tsx` se isso afetar Humanos/Viaturas/Binômios desnecessariamente;
- reutilizar primitivas existentes quando fizer sentido;
- não criar nova arquitetura global.

---

# 22. LOADING

Substituir a experiência textual simples por loading estrutural onde fizer sentido:

- skeleton dos KPIs;
- skeleton do roster;
- skeleton localizado do drawer.

Não bloquear todo o shell se só o drawer estiver carregando.

---

# 23. EMPTY STATES

Cobrir:

## Nenhum K9 cadastrado

- mensagem clara;
- CTA de cadastro somente se permitido.

## Nenhum resultado por filtros

```text
Nenhum K9 corresponde aos filtros selecionados.
```

Adicionar ação para limpar filtros.

## Grupo vazio

Não renderizar seção vazia.

---

# 24. ERROR STATES

Falha da listagem:

- manter shell;
- informar erro;
- não converter falha em número `0`.

Falha somente no drawer:

- roster continua funcional;
- erro localizado no drawer;
- fechamento continua disponível.

---

# 25. CORES SEMÂNTICAS

Usar:

```text
cyan     → identidade, foco, seleção
verde    → pronto/operacional
amarelo  → formação/atenção não bloqueante
vermelho → indisponibilidade/bloqueio real
```

Cor nunca deve ser o único sinal.

Status sempre precisa de label textual.

---

# 26. RESPONSIVIDADE

Validar no mínimo:

```text
1920x1080
1440x900
1280x800
tablet
mobile
```

Regras:

- drawer inline somente quando houver largura suficiente;
- em telas menores vira sheet;
- filtros quebram/empilham;
- cards não estouram largura;
- nomes/raças/especialidades longas não quebram layout;
- CTA continua utilizável;
- grid passa para 2 e depois 1 coluna quando necessário.

---

# 27. ACESSIBILIDADE

Garantir:

- `aria-expanded` no grupo Efetivo;
- foco visível;
- navegação por teclado;
- card acionável;
- botão fechar do drawer com `aria-label`;
- Escape fecha drawer overlay;
- status com texto além de cor;
- alt de imagens;
- `prefers-reduced-motion`;
- sem hover obrigatório.

---

# 28. ANIMAÇÕES

Pode usar animações discretas já compatíveis com a stack:

- expansão do submenu;
- hover do card;
- seleção;
- entrada/saída do drawer;
- transição de filtro;
- skeleton.

NÃO usar:

- partículas;
- parallax;
- glow pulsante contínuo;
- animação permanente;
- efeito que transforme a tela em HUD de videogame.

---

# 29. TESTES — NAVEGAÇÃO

Criar/ajustar testes para provar:

- Efetivo expande;
- Efetivo recolhe;
- `/k9` autoexpande o pai;
- `Efetivo K9` fica ativo em `/k9`;
- `/humans` ativa Humano;
- `/binomials` ativa Binômios;
- `/vehicles` ativa Viaturas;
- filhos sem permissão não aparecem;
- `/effective` resolve rota permitida sem loop;
- mobile fecha sidebar após navegar para filho.

---

# 30. TESTES — CLASSIFICAÇÃO K9

Testar a função pura com:

1. K9 administrativo inativo;
2. especialidade operacional;
3. especialidade em formação;
4. ativo sem especialidade;
5. `temporarily_unfit`;
6. `fit_with_restrictions`;
7. `operational_attention`;
8. readiness ausente.

Confirmar que:

- indisponibilidade absoluta prevalece;
- restrição parcial não vira bloqueio total automaticamente;
- ausência de readiness não vira operacional clínica;
- todos os K9 recebem exatamente um grupo.

---

# 31. TESTES — FILTROS

Cobrir:

- busca por nome;
- matrícula;
- raça;
- operador;
- status;
- especialidade;
- operador;
- combinações;
- limpar filtros;
- grupos após filtro.

---

# 32. TESTES — DRAWER

Cobrir:

- abre ao selecionar card;
- fecha no X;
- fecha com Escape quando overlay;
- troca K9 selecionado;
- loading localizado;
- erro localizado;
- ausência de foto;
- ausência de microchip/cor;
- ausência de binômio;
- readiness indisponível;
- ações só aparecem/habilitam quando resolvíveis.

---

# 33. TESTES — PERMISSÃO

Confirmar:

```text
can("k9", "create") == false
→ botão Cadastrar K9 não aparece
```

Não alterar a matriz de permissões.

---

# 34. VALIDAÇÃO ESTÁTICA E GLOBAL

Depois da implementação:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Também execute:

```powershell
git diff --check
git status --short
git diff --stat
git diff --name-status
```

Se o projeto possuir suites direcionadas para shell/effective/k9, execute também de forma isolada e reporte.

Separar objetivamente:

- falhas novas;
- falhas preexistentes;
- warnings preexistentes;
- warnings novos.

Não afirmar que uma falha é preexistente sem prova.

---

# 35. INSPEÇÃO VISUAL

Subir a aplicação localmente se necessário, sem deploy.

Validar a tela contra o mockup aprovado.

Inspecionar:

- sidebar;
- submenu;
- header;
- KPIs;
- filtros;
- seções;
- cards;
- seleção;
- drawer;
- scroll;
- empty states;
- loading;
- erros;
- responsividade.

Não editar o Dashboard para “fazer combinar”.

A tela nova deve adaptar-se ao Dashboard existente.

---

# 36. NÃO FAZER COMMIT/PUSH

Ao final:

NÃO executar:

```text
git commit
git push
git rebase
git cherry-pick
git reset
git stash
git clean
```

NÃO fazer deploy.

Deixar o workspace com as alterações visíveis para revisão humana.

---

# 37. STATUS FINAL

Executar:

```powershell
git status --short
git diff --check
git diff --stat
git diff --name-status
git diff -- src/components/layout/app-shell.tsx
git diff -- "src/app/(app)/effective/page.tsx"
git diff -- "src/app/(app)/k9/page.tsx"
```

E os diffs dos novos componentes/hooks/testes criados.

Comparar `git status --short` com a baseline inicial e identificar claramente:

- arquivos preexistentes;
- arquivos alterados nesta rodada;
- novos arquivos desta rodada.

---

# 38. ENTREGA FINAL

Reportar diretamente na tela:

1. baseline inicial do workspace;
2. branch;
3. HEAD;
4. arquivos preexistentes preservados;
5. resultado da reauditoria;
6. confirmação do estado atual de `/effective`;
7. confirmação das rotas existentes;
8. confirmação do finding `subscribeCollection`, se ainda existir;
9. arquivos alterados;
10. arquivos novos;
11. nova estrutura da sidebar;
12. comportamento de `/effective`;
13. nova composição de `/k9`;
14. contrato final de classificação usado;
15. tratamento do K9 ativo sem classificação;
16. filtros implementados;
17. paginação removida ou justificativa caso mantida;
18. card K9 implementado;
19. drawer implementado;
20. fontes reais usadas no drawer;
21. status da integração de readiness Health;
22. status da próxima agenda/saúde;
23. rotas das ações do drawer;
24. comportamento responsivo;
25. acessibilidade;
26. testes direcionados;
27. `npm test`;
28. `npm run typecheck`;
29. `npm run lint`;
30. `npm run build`;
31. `git diff --check`;
32. status final;
33. confirmação de nenhum commit;
34. confirmação de nenhum push;
35. confirmação de nenhum deploy;
36. findings/pendências restantes;
37. comparação visual com o mockup;
38. recomendação objetiva: APROVAR PARA REVISÃO VISUAL ou BLOQUEAR.

Pare com todas as alterações ainda não commitadas para revisão humana.
