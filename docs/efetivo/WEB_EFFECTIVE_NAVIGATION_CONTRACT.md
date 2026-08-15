# K9 Ops Web — Contrato de Navegação do módulo Efetivo

| Campo | Valor |
|---|---|
| Status | IMPLEMENTADO / VALIDADO / APROVADO VISUALMENTE |
| Data | 2026-08-14 |
| Escopo | Sidebar, rotas e compatibilidade de `/effective` |
| Mockup | `WEB_EFFECTIVE_K9_APPROVED_MOCKUP.png` |

---

# 1. Decisão

O item `Efetivo` deixa de ser um link simples para uma página-hub e passa a ser um **grupo expansível** da sidebar.

Estrutura:

```text
Efetivo
├── Efetivo K9      → /k9
├── Efetivo Humano  → /humans
├── Binômios        → /binomials
└── Viaturas        → /vehicles
```

---

# 2. Comportamento desktop

## Estado fechado

Exibe apenas:

```text
Efetivo          chevron
```

## Ao clicar

- alterna expandido/recolhido;
- não troca o conteúdo principal apenas por expandir;
- mantém acessibilidade de teclado;
- `aria-expanded` reflete o estado.

## Autoexpansão

O grupo deve iniciar/ficar expandido quando o pathname atual pertence a:

- `/k9/**`
- `/humans/**`
- `/binomials/**`
- `/vehicles/**`
- `/effective`

---

# 3. Seleção ativa

A sidebar deve distinguir:

1. pai `Efetivo` ativo;
2. filho ativo.

Exemplo em `/k9`:

```text
[ATIVO] Efetivo
    [SELECIONADO] Efetivo K9
    Efetivo Humano
    Binômios
    Viaturas
```

O destaque do filho deve ser mais compacto que o destaque do pai, mantendo a identidade cyan atual.

---

# 4. Permissões

Cada subitem só aparece se o usuário puder visualizar o respectivo módulo.

Mapeamento:

```text
Efetivo K9      → can("k9", "view")
Efetivo Humano  → can("humans", "view")
Binômios        → can("binomials", "view")
Viaturas        → can("vehicles", "view")
```

Se nenhum filho estiver liberado:

- o grupo Efetivo não deve oferecer navegação funcional;
- manter comportamento fail-closed;
- não revelar rotas não autorizadas por conveniência visual.

---

# 5. Compatibilidade de `/effective`

A rota `/effective` existe hoje e pode estar salva em favoritos, histórico ou links internos.

Ela deve permanecer durante a migração.

## Regra

Ao acessar `/effective`:

1. resolver os filhos permitidos;
2. priorizar `/k9` se `k9/view` estiver liberado;
3. caso contrário redirecionar para o primeiro filho permitido;
4. se nenhum filho estiver liberado, manter a tela de acesso negado/nenhum núcleo liberado.

Não apagar `/effective` nesta fase.

---

# 6. Mobile / sidebar responsiva

No shell mobile:

- tocar `Efetivo` expande os filhos;
- tocar um filho navega e fecha o drawer móvel;
- o item ativo permanece identificável quando o menu é reaberto;
- nenhuma interação deve depender de hover.

---

# 7. Rotas de cadastro e perfil

Rotas existentes continuam independentes:

```text
/k9/new
/k9/{dogId}
/k9/{dogId}/edit
/humans/new
/humans/{ra}
/binomials/new
/binomials/{id}
/vehicles/new
/vehicles/{id}
```

O agrupamento da sidebar não deve alterar as regras de acesso dessas rotas.

---

# 8. Comportamento proibido

- renderizar novamente os quatro cards K9/Humanos/Viaturas/Binômios dentro de `/k9`;
- duplicar as mesmas opções em sidebar e conteúdo principal;
- criar novas rotas `/effective/k9`, `/effective/humans` etc. sem necessidade;
- conceder acesso ao pai se o usuário não possuir acesso a nenhum filho;
- usar o estado visual da sidebar como mecanismo de autorização.

---

# 9. Critérios de aceite

- `/k9` abre com `Efetivo` expandido e `Efetivo K9` selecionado;
- `/humans` abre com `Efetivo Humano` selecionado;
- `/binomials` abre com `Binômios` selecionado;
- `/vehicles` abre com `Viaturas` selecionado;
- `/effective` redireciona sem loop;
- permissão por filho continua respeitada;
- Dashboard e demais itens da sidebar não sofrem regressão;
- mobile sidebar fecha após escolha do filho;
- navegação por teclado funciona.
