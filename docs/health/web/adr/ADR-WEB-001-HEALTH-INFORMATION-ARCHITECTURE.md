# ADR-WEB-001 — Arquitetura da Informação do Health Web

| Campo | Valor |
|---|---|
| Status | Proposto — revisão humana pendente |
| Data | 2026-07-30 |
| Escopo | Health Web v1 |
| Decisores | Produto, domínio Health, arquitetura Web |
| Relacionados | `HEALTH_WEB_INFORMATION_ARCHITECTURE.md`, ADR-001 e ADR-007 canônicas |

---

## Contexto

A Web atual possui uma página de Saúde pré-Foundation, monolítica e sem uso operacional consolidado. O Health v1 canônico cresceu em subdomínios distintos: prontidão, restrições, agenda, casos clínicos, exames, tratamentos, Nutrição, documentos, timeline e auditoria.

Existia o risco de:

- criar um item de Sidebar para cada subdomínio;
- manter um prontuário concorrente no perfil `/k9/{dogId}`;
- replicar a navegação Mobile;
- concentrar novamente tudo em `/health`;
- transformar collections em páginas.

## Decisão

O Health Web v1 terá:

1. um único item principal **Saúde** na Sidebar;
2. entrada global em `/health`;
3. navegação secundária interna;
4. visão global do efetivo;
5. cockpit individual por K9;
6. páginas de entidade para lifecycles complexos;
7. deep links e filtros na URL;
8. perfil institucional do K9 como resumo e ponte, não prontuário paralelo.

Rotas principais:

```text
/health
/health/readiness
/health/schedule
/health/clinical
/health/nutrition
/health/history
/health/reports
/health/audit
```

## Consequências positivas

- Sidebar estável;
- crescimento modular;
- orientação global → individual → entidade;
- menos duplicação;
- deep links;
- responsibilities claras;
- mockups e testes por rota.

## Consequências negativas

- shell interno adicional;
- navegação mais complexa;
- necessidade de redirects do legado;
- decisões de subrota/tabs;
- maior disciplina de contratos.

## Alternativas rejeitadas

### Item por subdomínio na Sidebar

Rejeitado por poluição e fragmentação.

### Prontuário completo em `/k9/{dogId}`

Rejeitado por criar autoridade concorrente.

### Página única com tabs sem URL

Rejeitado por prejudicar deep links, back button e permissionamento.

### Cópia da navegação Mobile

Rejeitado porque a Web é gerencial e o Mobile é operacional.

## Limites

Esta ADR não decide:

- design visual;
- route final de cada detalhe;
- posição definitiva da Auditoria;
- grants;
- schema.

## Critérios de conformidade

- um item Saúde na Sidebar;
- item ativo em todas as rotas Health;
- cockpit oficial dentro de Health;
- filtros relevantes na URL;
- entidades profundas com URL;
- sem página monolítica universal.

## Critérios para revisão futura

Revisar se:

- o módulo possuir mais de dez áreas primárias;
- houver portal externo veterinário;
- relatórios forem centralizados globalmente;
- arquitetura de navegação do K9 Ops mudar.
