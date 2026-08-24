# K9 Ops Web — Health Web v1 Permission Matrix

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_PERMISSION_MATRIX.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Matriz candidata de perfis, capabilities, canais, escopos e evidências |
| Repositório Web | `github.com/jillohh-arch/k9-ops` |
| Branch principal auditada | `master` |
| Branch funcional auditada | `feature/health-web-nutrition` |
| Baseline | `HEALTH_WEB_BASELINE.md` |
| Inventário de capabilities | `HEALTH_WEB_CAPABILITIES_INVENTORY.md` |
| Matriz de responsabilidades | `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md` |
| Autoridade conceitual | `HEALTH_V1_PERMISSION_MATRIX.md` |
| Fora de escopo | Criar grants, alterar profiles, claims, Rules, Functions, usuários ou produção |

---

## 1. Propósito

Este documento cruza:

```text
perfil
× capability
× canal
× escopo
× entidade
× lifecycle
× evidência
× auditoria
```

Ele tem cinco objetivos:

1. representar o estado genérico atual da Web;
2. propor uma matriz-alvo coerente com o Health v1;
3. separar executor operacional de gestor administrativo;
4. impedir que administração técnica seja confundida com autoridade clínica;
5. preparar a futura implementação de profiles, Rules, callables e guards.

Este documento não concede acesso.

Ele registra:

- atribuições candidatas;
- atribuições não recomendadas;
- decisões pendentes;
- dependências de inventário;
- condições adicionais para cada ação.

---

## 2. Princípio fundamental

> **Administração técnica não equivale a autorização clínica.**

Nenhum perfil interno se torna profissional veterinário por possuir:

- role de Administrador;
- specialty `Veterinário`;
- acesso total à Web;
- capability de gestão;
- bypass técnico;
- capacidade de alterar profiles.

Decisões clínicas externas continuam representadas por:

```text
ProfessionalIdentity
```

O usuário autenticado que registra a informação continua representado por:

```text
RecordedBy
```

---

## 3. Estado de aprovação desta matriz

### 3.1 Nenhum grant novo está aprovado

As atribuições-alvo deste documento são classificadas como candidatas.

### 3.2 Exceção de implementação

A capability:

```text
health.manage_nutrition_plan
```

já foi implementada na branch funcional de Nutrição.

Entretanto, o profile ou usuário que a recebe em produção não foi inventariado neste programa documental.

Portanto:

- a capability existe;
- os comandos existem;
- a atribuição por perfil continua não aprovada neste documento.

### 3.3 Produção não foi auditada

Ainda não foram inspecionados, neste trabalho:

- documentos reais de `access_profiles`;
- usuários associados;
- custom claims emitidas;
- grants customizados;
- escopos efetivos;
- uso real do fallback `operador_k9`;
- uso real do bypass administrativo.

---

## 4. Legenda de classificação

| Símbolo | Classificação | Significado |
|---|---|---|
| `C` | Candidata | atribuição plausível para revisão humana |
| `P` | Pendente | depende de decisão de produto, domínio ou segurança |
| `N` | Não recomendada | não pertence ao perfil no desenho-alvo |
| `M` | Mobile-only | capability existe, mas não para a Web |
| `S` | Sistema | executada por Backend/Function/Admin SDK |
| `L` | Legado temporário | grant genérico atual, não alvo |
| `A` | Aprovada | grant formalmente aprovado após gate humano |
| `—` | Não aplicável | não se aplica àquele perfil/canal |

### 4.1 Estado inicial

Nenhuma célula desta versão usa `A`.

---

## 5. Perfis considerados

### 5.1 Operador K9

Natureza:

- condutor;
- executor operacional;
- usuário Mobile primário;
- usuário Web de consulta;
- pode registrar fatos observados ou executados conforme capability;
- não exerce decisão clínica externa.

### 5.2 Instrutor K9

Natureza:

- responsável por treinamento e avaliação cinotécnica;
- pode precisar consultar prontidão e restrições;
- não recebe capacidade clínica apenas por ser Instrutor;
- escopo Health ainda precisa ser decidido.

### 5.3 Gestor

Natureza:

- coordenação do efetivo;
- planejamento;
- administração;
- supervisão;
- relatórios;
- transcrição autorizada;
- gestão Web prioritária.

### 5.4 Administrador

Natureza:

- configuração técnica;
- perfis;
- suporte;
- governança sistêmica;
- não é profissional clínico;
- não deve receber todas as ações clínicas por padrão.

### 5.5 Perfis futuros possíveis

Não aprovados:

- Auditor;
- Controle Interno;
- Gestor de Saúde;
- Suporte técnico break-glass;
- Operador administrativo.

A criação desses perfis depende de necessidade real.

---

## 6. Perfis genéricos atuais observados na Web

A auditoria do repositório identificou defaults equivalentes a:

| Perfil atual | `view` | `create` | `edit` | `archive` | `export` | `audit` |
|---|---:|---:|---:|---:|---:|---:|
| Operador K9 | sim | sim | sim | não | não | não |
| Instrutor K9 | sim | sim | sim | não | não | não |
| Gestor | sim | não observado | sim | sim | sim | sim |
| Administrador | amplo/all | amplo/all | amplo/all | amplo/all | amplo/all | amplo/all |

### 6.1 Natureza

Esses grants são:

```text
LEGACY_GENERIC
```

### 6.2 Não equivalem à matriz-alvo

Exemplos:

- `create` não equivale a `record_incident`;
- `edit` não equivale a `amend_record`;
- `archive` não equivale a `cancel_case`;
- `view` não prova `health.read`;
- `audit` com mesmo nome ainda precisa de reconciliação semântica.

---

## 7. Modelo-alvo de decisão

Uma operação será permitida somente quando todas as condições aplicáveis forem verdadeiras:

```text
authenticated
AND profile_active
AND web_or_mobile_access
AND canAccessDogRecord(dogId)
AND scope_allows
AND capability_granted
AND lifecycle_allows
AND evidence_present
AND backend_validation_passes
```

### 7.1 Capability isolada não basta

Exemplo:

```text
health.issue_restriction == true
```

não autoriza registro se faltarem:

- acesso ao K9;
- ProfessionalIdentity;
- source document;
- estado compatível;
- motivo;
- autenticação;
- Backend disponível.

---

# Parte I — Matriz executiva de leitura

## 8. `health.read`

### 8.1 Proposta candidata

| Perfil | Mobile | Web | Escopo candidato | Classificação |
|---|---:|---:|---|---|
| Operador K9 | C | C | K9s permitidos pelo profile/access scope | C |
| Instrutor K9 | C | C | K9s da unidade ou escopo autorizado | P |
| Gestor | C | C | efetivo sob gestão | C |
| Administrador | P | P | suporte técnico ou escopo explicitamente concedido | P |

### 8.2 Justificativa

Operador precisa consultar:

- prontidão;
- restrições;
- agenda;
- tratamento;
- plano alimentar;
- histórico necessário à execução.

Gestor precisa consultar:

- efetivo global;
- casos;
- agenda;
- relatórios;
- gestão.

Instrutor pode precisar consultar:

- restrições que impactam treinamento;
- prontidão;
- limitações.

Mas a extensão da leitura clínica completa ainda precisa ser decidida.

Administrador não deve receber leitura clínica integral apenas por administrar o sistema.

### 8.3 Dados incluídos

`health.read` candidata a incluir:

- agregados Health do K9 dentro do escopo;
- ProfessionalIdentity necessária ao contexto;
- metadados de documentos;
- projections;
- legado identificado.

### 8.4 Não inclui automaticamente

- audit log completo;
- exportação;
- download de todo documento sensível;
- migração;
- reconciliação;
- alteração de profiles;
- dados fora do scope.

---

## 9. Leitura por tela

| Tela | Operador | Instrutor | Gestor | Administrador | Capability |
|---|---:|---:|---:|---:|---|
| Visão Geral | C | P | C | P | `health.read` |
| Prontidão | C | C | C | P | `health.read` |
| Cockpit individual | C | P | C | P | `health.read` |
| Restrições | C | C | C | P | `health.read` |
| Agenda | C | P | C | P | `health.read` |
| Casos clínicos | C | P | C | P | `health.read` |
| Tratamentos | C | P | C | P | `health.read` |
| Nutrição | C | P | C | P | `health.read` |
| Peso | C | P | C | P | `health.read` |
| Vacinação | C | P | C | P | `health.read` |
| Documentos metadata | C | P | C | P | `health.read` |
| Histórico | C | P | C | P | `health.read` |
| Relatórios em tela | P | P | C | P | `health.read` |
| Auditoria | N | N | P | P | `health.audit` |

### 9.1 Observação

Esta tabela não cria capabilities por tela.

Ela aplica `health.read` com escopos diferentes.

---

# Parte II — Rotina

## 10. `health.record_routine`

| Perfil | Mobile | Web | Escopo candidato | Classificação |
|---|---:|---:|---|---|
| Operador K9 | C | N | K9s autorizados | C/M |
| Instrutor K9 | P | N | somente se também executor autorizado | P |
| Gestor | P | N | execução excepcional, não gestão | P |
| Administrador | N | N | — | N |

### 10.1 Operações

- peso;
- refeição;
- suplemento.

### 10.2 Web

Na Web-alvo:

- refeição: não;
- suplemento: não;
- peso: decisão pendente e provavelmente capability separada ou modalidade de transcrição.

### 10.3 Evidência

Execução direta interna:

- `recorded_by`;
- executor;
- data efetiva;
- contexto.

Sem inventar profissional externo.

---

# Parte III — Prevenção

## 11. `health.record_preventive`

| Perfil | Mobile | Web | Modalidade | Classificação |
|---|---:|---:|---|---|
| Operador K9 | C | P | execução interna ou transcrição autorizada | P |
| Instrutor K9 | N | N | não pertence ao papel de treinamento | N |
| Gestor | P | C | transcrição e gestão preventiva | C |
| Administrador | N | N | administração técnica não basta | N |

### 11.1 Operações possíveis

- vacinação;
- vermifugação, quando agregado for aprovado;
- outro preventivo contratualmente definido.

### 11.2 Execução interna

Requisitos:

- capability;
- executor real;
- lote/fabricante quando aplicável;
- data;
- auditoria.

`professional` pode ser `null`.

### 11.3 Informação externa

Requisitos:

- ProfessionalIdentity;
- source document;
- data efetiva;
- RecordedBy;
- capability;
- auditoria.

### 11.4 Decisão pendente

Definir exatamente quais ações preventivas podem ser registradas pela Web.

---

# Parte IV — Intercorrências e clínico

## 12. `health.record_incident`

| Perfil | Mobile | Web | Escopo candidato | Classificação |
|---|---:|---:|---|---|
| Operador K9 | C | P | K9s autorizados | C |
| Instrutor K9 | P | P | incidente observado durante treino | P |
| Gestor | C | C | efetivo sob gestão | C |
| Administrador | N | N | — | N |

### 12.1 Natureza

Observação direta.

Não exige ProfessionalIdentity por padrão.

### 12.2 Efeito

Pode abrir:

- ClinicalCase;
- ClinicalEvent `incident`.

### 12.3 Guard

Não permite diagnóstico.

---

## 13. `health.record_clinical_document`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | P | P | P |
| Instrutor K9 | N | N | N |
| Gestor | P | C | C |
| Administrador | N | N | N |

### 13.1 Uso

Transcrever:

- consulta;
- laudo;
- evolução;
- decisão profissional;
- documento clínico.

### 13.2 Evidência

Obrigatória:

- ProfessionalIdentity;
- source document quando aplicável;
- RecordedBy;
- data efetiva.

### 13.3 Risco

Essa capability expõe writes clínicos significativos.

A atribuição a Operador precisa de decisão humana.

---

## 14. `health.discharge_case`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | N | N |
| Instrutor K9 | N | N | N |
| Gestor | N | C | C |
| Administrador | N | N | N |

### 14.1 Requisitos

- caso elegível;
- ProfessionalIdentity;
- source document;
- motivo;
- evento discharge;
- auditoria.

---

## 15. `health.reopen_case`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | N | N |
| Instrutor K9 | N | N | N |
| Gestor | N | C | C |
| Administrador | N | N | N |

### 15.1 Requisitos

- caso discharged;
- motivo;
- target status válido;
- evidência quando aplicável;
- auditoria.

---

## 16. `health.cancel_case`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | N | N |
| Instrutor K9 | N | N | N |
| Gestor | N | C | C |
| Administrador | N | P | P |

### 16.1 Natureza

Ação administrativa, não alta clínica.

### 16.2 Admin

Pode ser candidato somente para correção administrativa controlada.

Não deve receber por bypass automático.

---

## 17. `health.cancel_record`

| Perfil | Mobile | Web | Escopo | Classificação |
|---|---:|---:|---|---|
| Operador K9 | P | P | próprios drafts/registros, conforme contrato | P |
| Instrutor K9 | N | N | — | N |
| Gestor | P | C | registros do efetivo sob gestão | C |
| Administrador | N | P | correção administrativa break-glass | P |

### 17.1 Não equivale

- hard delete;
- archive;
- edit;
- liberação clínica.

---

## 18. `health.amend_record`

| Perfil | Mobile | Web | Escopo | Classificação |
|---|---:|---:|---|---|
| Operador K9 | P | P | próprios registros ou K9 autorizado | P |
| Instrutor K9 | N | N | — | N |
| Gestor | P | C | efetivo sob gestão | C |
| Administrador | N | P | suporte controlado | P |

### 18.1 Requisitos

- original final;
- tipo de amendment;
- motivo;
- conteúdo;
- autoria;
- append-only;
- auditoria.

---

# Parte V — Exames

## 19. `health.request_exam`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | P | P | P |
| Instrutor K9 | N | N | N |
| Gestor | P | C | C |
| Administrador | N | N | N |

### 19.1 Requisitos

- caso clínico;
- solicitação externa;
- ProfessionalIdentity recomendada;
- urgência;
- motivo;
- auditoria.

---

## 20. `health.interpret_exam`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | N | N |
| Instrutor K9 | N | N | N |
| Gestor | N | C | C |
| Administrador | N | N | N |

### 20.1 Importante

A capability autoriza transcrever a interpretação do profissional externo.

Ela não transforma o Gestor em intérprete clínico.

### 20.2 Evidência

- ProfessionalIdentity;
- result document;
- source document;
- interpretação;
- RecordedBy.

---

## 21. Capabilities de exame ainda ausentes

A matriz atual não possui nomes finais para:

- registrar coleta;
- registrar resultado;
- avaliar impacto;
- cancelar processo.

### 21.1 Classificação

`P`.

### 21.2 Regra

Não reutilizar `health.edit` ou `health.record_clinical_document` sem decisão formal.

---

# Parte VI — Tratamento e dose

## 22. `health.create_treatment`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | N | N |
| Instrutor K9 | N | N | N |
| Gestor | N | C | C |
| Administrador | N | N | N |

### 22.1 Requisitos

- caso;
- prescrição;
- ProfessionalIdentity;
- source document;
- dose;
- frequência;
- vigência;
- auditoria.

---

## 23. `health.complete_treatment`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | N | N |
| Instrutor K9 | N | N | N |
| Gestor | N | C | C |
| Administrador | N | N | N |

### 23.1 Requisitos

- protocolo active/paused;
- motivo;
- evidência quando aplicável;
- encerramento de agenda;
- auditoria.

---

## 24. Pausar, retomar e cancelar tratamento

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | N | N |
| Instrutor K9 | N | N | N |
| Gestor | N | P | P |
| Administrador | N | N | N |

### 24.1 Capability final

Ainda não definida.

### 24.2 Regra

Não usar:

- `health.edit`;
- `health.archive`;
- `health.complete_treatment`;

para ações semanticamente diferentes sem contrato explícito.

---

## 25. `health.administer_dose`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | C | N | C/M |
| Instrutor K9 | N | N | N |
| Gestor | P | N | P |
| Administrador | N | N | N |

### 25.1 Requisitos

- protocolo ativo;
- occurrence;
- dose;
- executor;
- horário;
- idempotência;
- auditoria.

### 25.2 Gestor

Somente candidato se atuar também como executor operacional.

O profile Gestor, por si só, não deveria conceder execução.

---

# Parte VII — Restrições

## 26. `health.issue_restriction`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | P | P | P |
| Instrutor K9 | N | N | N |
| Gestor | P | C | C |
| Administrador | N | N | N |

### 26.1 Evidência obrigatória

- ProfessionalIdentity;
- source document;
- nível;
- categoria;
- vigência;
- atividades restringidas;
- RecordedBy.

### 26.2 Operador

Pode ser candidato para transcrição no Mobile ou Web.

A aprovação depende do fluxo operacional escolhido.

---

## 27. `health.release_restriction`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | P | P | P |
| Instrutor K9 | N | N | N |
| Gestor | P | C | C |
| Administrador | N | N | N |

### 27.1 Evidência obrigatória

- end ProfessionalIdentity;
- end source document;
- end reason;
- actual end;
- RecordedBy.

### 27.2 Proibição

Passagem da data esperada não encerra a restrição.

---

# Parte VIII — Agenda

## 28. `health.schedule_item`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | P | P | P |
| Instrutor K9 | P | P | P |
| Gestor | P | C | C |
| Administrador | N | N | N |

### 28.1 Instrutor

Pode precisar criar:

- reavaliação;
- acompanhamento;
- pesagem;
- item ligado a treinamento com impacto Health.

Mas essa fronteira ainda não está aprovada.

### 28.2 Limite

Criar agenda não altera:

- prontidão;
- caso;
- restrição;
- execução.

---

## 29. `health.manage_schedule`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | P | P |
| Instrutor K9 | N | P | P |
| Gestor | N | C | C |
| Administrador | N | N | N |

### 29.1 Operações

- reagendar;
- cancelar;
- editar campo administrativo permitido.

### 29.2 Conclusão

A conclusão depende da capability do fato executado.

---

# Parte IX — Nutrição

## 30. `health.manage_nutrition_plan`

| Perfil | Mobile | Web | Classificação |
|---|---:|---:|---|
| Operador K9 | N | N | N |
| Instrutor K9 | N | N | N |
| Gestor | N | C | C |
| Administrador | N | P | P |

### 30.1 Decisão candidata

Gestor é o candidato natural.

### 30.2 Administrador

Pode receber apenas se houver decisão explícita de administração funcional.

Admin técnico não deve receber automaticamente.

### 30.3 Requisitos

- operationId;
- callable;
- capability específica;
- acesso ao K9;
- lifecycle;
- audit;
- receipt.

### 30.4 Sem fallback

Não aceitar:

```text
health.edit
```

---

# Parte X — Auditoria, relatórios e documentos

## 31. `health.audit`

| Perfil | Mobile | Web | Escopo | Classificação |
|---|---:|---:|---|---|
| Operador K9 | N | N | — | N |
| Instrutor K9 | N | N | — | N |
| Gestor | N | P | unidade/efetivo | P |
| Administrador | N | P | suporte/auditoria técnica | P |

### 31.1 Decisão pendente

Definir se:

- Gestor vê auditoria funcional;
- Administrador vê auditoria técnica;
- haverá profile Auditor;
- a auditoria Health ficará no módulo geral.

---

## 32. Exportação

Capability final ainda não existe.

Candidato:

```text
health.export_reports
```

| Perfil | Web | Classificação |
|---|---:|---|
| Operador K9 | N | N |
| Instrutor K9 | N | N |
| Gestor | C | C |
| Administrador | P | P |
| Auditor futuro | P | P |

### 32.1 Requisitos

- filtros;
- escopo;
- minimização;
- justificativa quando sensível;
- audit log;
- proteção de arquivo;
- expiração.

---

## 33. Download de documentos

Capability candidata:

```text
health.download_documents
```

| Perfil | Web/Mobile | Classificação |
|---|---:|---|
| Operador K9 | P | P |
| Instrutor K9 | P | P |
| Gestor | C | C |
| Administrador | P | P |

### 33.1 Dependência

A capability só é útil se o acesso ao metadata e ao arquivo puder ser protegido separadamente.

### 33.2 Não aprovada

A Permission Matrix canônica atual usa `health.read` para visualização.

A separação de download precisa de decisão documental.

---

## 34. Upload de documentos

Não existe capability única aprovada para todo documento.

O comando deverá usar a capability da finalidade:

| Finalidade | Capability |
|---|---|
| consulta/laudo | `health.record_clinical_document` |
| vacina/preventivo | `health.record_preventive` |
| exame | capability da transição de exame |
| tratamento | `health.create_treatment` ou ação relacionada |
| restrição | `health.issue_restriction` |
| plano alimentar | `health.manage_nutrition_plan` |
| documento avulso | pendente |

---

# Parte XI — Matriz consolidada de capabilities

## 35. Matriz por perfil — Web

| Capability | Operador | Instrutor | Gestor | Administrador |
|---|---:|---:|---:|---:|
| `health.read` | C | P | C | P |
| `health.record_routine` | N | N | N | N |
| `health.record_preventive` | P | N | C | N |
| `health.record_incident` | P | P | C | N |
| `health.record_clinical_document` | P | N | C | N |
| `health.request_exam` | P | N | C | N |
| `health.interpret_exam` | N | N | C | N |
| `health.create_treatment` | N | N | C | N |
| `health.administer_dose` | N | N | N | N |
| `health.issue_restriction` | P | N | C | N |
| `health.release_restriction` | P | N | C | N |
| `health.discharge_case` | N | N | C | N |
| `health.reopen_case` | N | N | C | N |
| `health.cancel_case` | N | N | C | P |
| `health.complete_treatment` | N | N | C | N |
| `health.schedule_item` | P | P | C | N |
| `health.manage_schedule` | P | P | C | N |
| `health.cancel_record` | P | N | C | P |
| `health.amend_record` | P | N | C | P |
| `health.manage_nutrition_plan` | N | N | C | P |
| `health.audit` | N | N | P | P |
| `health.export_reports` | N | N | C | P |
| `health.download_documents` | P | P | C | P |

---

## 36. Matriz por perfil — Mobile

| Capability | Operador | Instrutor | Gestor | Administrador |
|---|---:|---:|---:|---:|
| `health.read` | C | P | C | P |
| `health.record_routine` | C | P | P | N |
| `health.record_preventive` | C | N | P | N |
| `health.record_incident` | C | P | C | N |
| `health.record_clinical_document` | P | N | P | N |
| `health.request_exam` | P | N | P | N |
| `health.interpret_exam` | N | N | N | N |
| `health.create_treatment` | N | N | N | N |
| `health.administer_dose` | C | N | P | N |
| `health.issue_restriction` | P | N | P | N |
| `health.release_restriction` | P | N | P | N |
| `health.discharge_case` | N | N | N | N |
| `health.reopen_case` | N | N | N | N |
| `health.cancel_case` | N | N | N | N |
| `health.complete_treatment` | N | N | N | N |
| `health.schedule_item` | P | P | P | N |
| `health.manage_schedule` | N | N | N | N |
| `health.cancel_record` | P | N | P | N |
| `health.amend_record` | P | N | P | N |
| `health.manage_nutrition_plan` | N | N | N | N |
| `health.audit` | N | N | N | N |

---

# Parte XII — Matriz de evidências

## 37. Evidência por capability

| Capability | ProfessionalIdentity | Source document | Motivo | OperationId | Auditoria |
|---|---:|---:|---:|---:|---:|
| `health.read` | não | não | não | não | leitura comum conforme política |
| `health.record_routine` | não para execução interna | não | opcional | recomendado | sim |
| `health.record_preventive` interno | não | não | opcional | recomendado | sim |
| `health.record_preventive` externo | sim | sim | opcional | recomendado | sim |
| `health.record_incident` | não | opcional | sim/contexto | recomendado | sim |
| `health.record_clinical_document` | sim | sim quando aplicável | contexto | recomendado | sim |
| `health.request_exam` | recomendado | recomendado | sim | recomendado | sim |
| `health.interpret_exam` | sim | sim | sim/contexto | recomendado | sim |
| `health.create_treatment` | sim | sim | contexto | obrigatório/recomendado | sim |
| `health.administer_dose` | não | não | conforme status | obrigatório | sim |
| `health.issue_restriction` | sim | sim | sim | obrigatório/recomendado | sim |
| `health.release_restriction` | sim | sim | sim | obrigatório/recomendado | sim |
| `health.discharge_case` | sim | sim | sim | recomendado | sim |
| `health.reopen_case` | quando aplicável | quando aplicável | sim | recomendado | sim |
| `health.cancel_case` | não | não | sim | recomendado | sim |
| `health.complete_treatment` | recomendado | conforme natureza | sim | recomendado | sim |
| `health.schedule_item` | não | não | contexto | recomendado | sim |
| `health.manage_schedule` | não | não | sim ao cancelar | recomendado | sim |
| `health.cancel_record` | não | não | sim | recomendado | sim |
| `health.amend_record` | conforme conteúdo | conforme conteúdo | sim | recomendado | sim |
| `health.manage_nutrition_plan` | conforme origem | conforme origem | conforme ação | sim | sim |
| `health.audit` | não | não | não | não | acesso pode ser auditado |
| exportação | não | não | possivelmente | sim | sim |

---

# Parte XIII — Escopo

## 38. Escopo por perfil candidato

| Perfil | Escopo candidato |
|---|---|
| Operador K9 | K9s acessíveis pelo profile; execução própria e registros permitidos |
| Instrutor K9 | K9s da unidade/treinamento, somente informações necessárias |
| Gestor | efetivo sob responsabilidade gerencial |
| Administrador | configuração e suporte; dados Health apenas quando explicitamente concedidos |

### 38.1 Operador

Não assumir automaticamente:

```text
own_records
```

para toda leitura Health.

Um K9 possui histórico longitudinal produzido por várias pessoas.

### 38.2 Gestor

Gestor não significa acesso global a todas as unidades sem scope.

### 38.3 Administrador

Suporte técnico deve usar:

- escopo mínimo;
- break-glass;
- motivo;
- duração;
- auditoria reforçada.

---

## 39. Acesso ao K9

Toda capability dog-scoped exige:

```text
canAccessDogRecord(dogId)
```

ou contrato equivalente.

### 39.1 Proibição

Uma capability Health global não deve permitir acesso a K9 fora do scope.

---

# Parte XIV — Lifecycles

## 40. Capability e estado da entidade

| Capability | Estado mínimo exigido |
|---|---|
| `health.reopen_case` | case `discharged` |
| `health.cancel_case` | case não terminal incompatível |
| `health.complete_treatment` | protocol `active` ou `paused` |
| `health.release_restriction` | restriction `active` |
| `health.manage_schedule` | schedule `open` |
| `health.cancel_record` | registro cancelável |
| `health.amend_record` | evento final e amendável |
| `health.manage_nutrition_plan` update | plano `active` |
| `health.manage_nutrition_plan` replace | plano `active` e sem conflito |
| `health.administer_dose` | protocolo `active` e occurrence válida |

### 40.1 Regra

Capability válida + lifecycle inválido = ação negada.

---

# Parte XV — Administração técnica

## 41. Ações do Administrador

### 41.1 Permitidas por natureza

- gerenciar profiles;
- revisar configuração;
- observar saúde técnica;
- executar suporte autorizado;
- iniciar migração por ferramenta própria;
- reconstruir projection por ferramenta administrativa;
- investigar logs técnicos.

### 41.2 Não concedidas automaticamente

- interpretar exame;
- emitir restrição;
- liberar restrição;
- criar tratamento;
- dar alta;
- administrar dose;
- criar plano alimentar;
- transcrever consulta;
- cancelar fato clínico.

### 41.3 Break-glass

Se existir:

- grant temporário;
- motivo obrigatório;
- expiração;
- escopo;
- audit reforçado;
- notificação;
- revisão posterior.

---

# Parte XVI — Instrutor K9

## 42. Fronteira proposta

Instrutor pode precisar de:

- leitura de prontidão;
- leitura de restrições;
- leitura de agenda relevante;
- registro de intercorrência observada;
- criação de reavaliação, se aprovado.

Instrutor não deve receber por padrão:

- acesso clínico irrestrito;
- tratamento;
- exame;
- restrição;
- documento sensível;
- alta;
- plano alimentar.

### 42.1 Decisão humana

Definir se o Instrutor:

1. usa apenas `health.read` com dados limitados;
2. usa `health.read` integral no escopo;
3. recebe uma projection operacional específica;
4. não acessa Clínico detalhado.

Essa é uma decisão importante de privacidade e produto.

---

# Parte XVII — Operador K9

## 43. Fronteira proposta

O Operador é executor de campo.

Candidatos fortes:

- `health.read`;
- `health.record_routine`;
- `health.record_incident`;
- `health.administer_dose`;
- `health.record_preventive` no Mobile.

Candidatos condicionais:

- documento clínico;
- solicitação de exame;
- restrição;
- liberação;
- amendment;
- cancelamento;
- agenda.

Não recomendados na Web:

- plano alimentar;
- tratamento;
- alta;
- interpretação;
- auditoria;
- exportação.

---

# Parte XVIII — Gestor

## 44. Fronteira proposta

O Gestor é o principal perfil Web Health.

Candidatos fortes:

- `health.read`;
- `health.record_preventive`;
- `health.record_incident`;
- `health.record_clinical_document`;
- `health.request_exam`;
- `health.interpret_exam`;
- `health.create_treatment`;
- `health.issue_restriction`;
- `health.release_restriction`;
- `health.discharge_case`;
- `health.reopen_case`;
- `health.cancel_case`;
- `health.complete_treatment`;
- `health.schedule_item`;
- `health.manage_schedule`;
- `health.cancel_record`;
- `health.amend_record`;
- `health.manage_nutrition_plan`;
- exportação futura.

### 44.1 Observação obrigatória

Essas são atribuições candidatas.

A concentração de capabilities exige:

- escopo;
- evidência;
- Backend;
- auditoria;
- treinamento;
- revisão humana.

---

# Parte XIX — Matriz de UI

## 45. Comportamento por permissão

| Situação | UI |
|---|---|
| capability ausente | ocultar ação |
| capability existe, lifecycle impede | desabilitar e explicar |
| capability existe, evidência ausente | abrir fluxo para anexar/preencher |
| profile inativo | bloquear módulo |
| scope não inclui K9 | forbidden |
| ação Mobile-only | não mostrar na Web |
| ação Web-only | não mostrar no Mobile |
| admin sem capability | não mostrar ação clínica |
| legacy fallback usado em leitura | indicador técnico |
| capability desconhecida | fail-closed |

---

## 46. Navegação

### 46.1 Item Saúde

Pode ser exibido quando houver leitura equivalente aprovada.

### 46.2 Subáreas

A ausência de capability de write não remove a página de leitura se `health.read` existir.

### 46.3 Auditoria

Só exibir para `health.audit`.

### 46.4 Relatórios

A tela pode ser visível com `health.read`.

O botão Exportar exige capability separada.

---

# Parte XX — Rules e Backend

## 47. Rules

Devem garantir:

- autenticação;
- profile ativo;
- access scope;
- dog access;
- read autorizada;
- negação de projection write;
- negação de legacy write;
- negação de direct write em agregados comandados;
- create-only de amendments quando aplicável.

### 47.1 Limite

Rules não substituem invariantes complexas.

---

## 48. Callables

Cada callable deverá declarar:

- capability;
- entity;
- lifecycle;
- evidence;
- idempotency;
- audit;
- error codes.

### 48.1 Exemplo

```text
healthNutritionReplacePlan
→ health.manage_nutrition_plan
```

### 48.2 Proibição

Callable não deve aceitar:

```text
health.edit
```

como alternativa.

---

# Parte XXI — Migração dos profiles

## 49. Inventário obrigatório

Antes de mudar grants:

- listar profiles ativos;
- extrair `permissions.health`;
- contar usuários;
- identificar customizações;
- identificar fallback;
- identificar aliases;
- identificar escopos;
- identificar claims stale.

### 49.1 Privacidade

O inventário pode usar dados agregados e IDs técnicos.

Não precisa publicar nomes de usuários.

---

## 50. Tabela de migração por profile

Cada profile real deverá receber uma análise:

| Campo | Conteúdo |
|---|---|
| profileId | identificador |
| status | ativo/inativo |
| usersCount | quantidade |
| grants atuais | ações |
| scope | escopo |
| uso atual | telas/ações |
| capabilities candidatas | proposta |
| grants removidos | diferença |
| risco | baixo/médio/alto |
| decisão | aprovar/ajustar/rejeitar |
| responsável | revisão humana |

---

## 51. Política de compatibilidade

### 51.1 Leitura

Pode haver adapter temporário:

```text
health.read
OR legacy health.view
```

somente se aprovado.

### 51.2 Write

Não haverá fallback genérico para write canônico.

### 51.3 Telemetria

Registrar uso do fallback sem conteúdo clínico.

### 51.4 Remoção

O adapter precisa de:

- prazo;
- métrica;
- gate;
- teste;
- commit de remoção.

---

# Parte XXII — Testes

## 52. Testes por capability

Cada capability deverá testar:

- perfil com grant;
- perfil sem grant;
- profile inativo;
- scope inválido;
- dog access negado;
- channel inválido;
- lifecycle inválido;
- evidência ausente;
- admin bypass;
- specialty Veterinário;
- fallback legado;
- Backend denial;
- UI ocultando;
- deep link;
- audit;
- revogação.

---

## 53. Testes por perfil

### 53.1 Operador

- lê K9 permitido;
- não lê K9 fora do scope;
- registra rotina Mobile;
- não gerencia plano;
- não interpreta exame;
- não acessa audit.

### 53.2 Instrutor

- vê prontidão conforme decisão;
- não recebe capability por specialty;
- não cria tratamento;
- não recebe acesso clínico integral sem grant.

### 53.3 Gestor

- administra plano;
- gerencia agenda;
- transcreve decisão com evidência;
- não consegue agir sem ProfessionalIdentity;
- não consegue ultrapassar scope.

### 53.4 Administrador

- não recebe ação clínica automaticamente;
- break-glass exige motivo;
- acesso é auditado;
- projection tools não ficam no módulo comum.

---

## 54. Testes de revogação

- profile desativado;
- capability removida;
- claim antiga;
- sessão aberta;
- página já carregada;
- tentativa de envio;
- offline queue;
- receipt;
- export em andamento.

Backend deve negar a operação após revogação, mesmo se a UI ainda estiver stale.

---

# Parte XXIII — Riscos

## 55. PM-RISK-001 — Matriz candidata virar seed

**Mitigação:** nenhum `A`; gate humano obrigatório.

## 56. PM-RISK-002 — Gestor concentrar privilégio excessivo

**Mitigação:** escopo, evidência e revisão por comando.

## 57. PM-RISK-003 — Admin receber tudo

**Mitigação:** administração técnica separada.

## 58. PM-RISK-004 — Instrutor acessar clínico indevidamente

**Mitigação:** decisão explícita sobre dados necessários.

## 59. PM-RISK-005 — Operador Web executar rotina

**Mitigação:** channel guard.

## 60. PM-RISK-006 — `view` permanecer para sempre

**Mitigação:** adapter temporário e telemetria.

## 61. PM-RISK-007 — Exportação sem capability

**Mitigação:** grant próprio.

## 62. PM-RISK-008 — Specialty autorizar

**Mitigação:** ignorar specialties no evaluator.

## 63. PM-RISK-009 — Lifecycle ignorado

**Mitigação:** Backend valida estado.

## 64. PM-RISK-010 — Evidência apenas na UI

**Mitigação:** Backend exige.

## 65. PM-RISK-011 — Profile real divergir dos defaults

**Mitigação:** inventário de produção.

## 66. PM-RISK-012 — Break-glass permanente

**Mitigação:** expiração e revisão.

---

# Parte XXIV — Decisões fixadas

## 67. Decisões

1. Nenhum grant novo está aprovado nesta versão.
2. A matriz usa candidatos, pendentes e não recomendados.
3. `health.read` é a leitura comum candidata.
4. Ações de write permanecem granulares.
5. Gestor é o principal candidato para gestão Web.
6. Operador é o principal executor Mobile.
7. Instrutor não recebe autorização clínica por função.
8. Administrador não recebe autorização clínica por natureza.
9. ProfessionalIdentity é independente do perfil.
10. RecordedBy é obrigatório.
11. Scope e dog access são obrigatórios.
12. Lifecycle é validado depois da capability.
13. Evidência é validada no Backend.
14. `health.manage_nutrition_plan` não usa fallback.
15. `health.audit` é separada de leitura.
16. Exportação terá decisão própria.
17. Rotina não será executada pela Web por padrão.
18. Profiles reais precisam ser inventariados.
19. Grants genéricos atuais são transitórios.
20. Nenhuma specialty concede capability.
21. Admin bypass será objeto de política própria.
22. Deep links também são protegidos.
23. Rules e callables são necessários.
24. UI não é autoridade.
25. Revogação deve surtir efeito no Backend.

---

# Parte XXV — Decisões humanas pendentes

## 68. Leitura

- `health.read` para Instrutor;
- profundidade clínica do Instrutor;
- leitura Health do Administrador;
- documentos sensíveis.

## 69. Writes do Operador

- documento clínico;
- solicitação de exame;
- restrição;
- liberação;
- cancelamento;
- amendment;
- agenda Web.

## 70. Writes do Gestor

- todos os candidatos listados;
- exigência de dupla revisão;
- limites de escopo;
- exportação;
- audit.

## 71. Administrador

- break-glass;
- cancelamento administrativo;
- auditoria técnica;
- ferramentas de projection;
- Nutrição.

## 72. Canais

- peso Web;
- vacinação Web;
- coleta e resultado Web;
- conclusão de agenda;
- dose transcrita.

## 73. Novas capabilities

- exportação;
- download;
- pause/resume treatment;
- coleta/resultado de exame;
- reconciliação;
- projection rebuild.

---

# Parte XXVI — Gates

## 74. Gate PM-1 — Inventário de profiles

Executar leitura real de `access_profiles`.

## 75. Gate PM-2 — Claims

Inventariar claims emitidas.

## 76. Gate PM-3 — Escopos

Validar `access_scope` e `canAccessDogRecord`.

## 77. Gate PM-4 — Perfis

Aprovar atribuições por perfil.

## 78. Gate PM-5 — Capabilities

Aprovar catálogo final.

## 79. Gate PM-6 — Evidências

Validar requisito por comando.

## 80. Gate PM-7 — Channels

Aprovar Web/Mobile por ação.

## 81. Gate PM-8 — Admin bypass

Aprovar política.

## 82. Gate PM-9 — Rules/Functions

Implementar e testar.

## 83. Gate PM-10 — Seed/migração

Gerar alteração de profiles somente após aprovação.

## 84. Gate PM-11 — Auditoria humana

Revisar diff dos grants.

## 85. Gate PM-12 — Ativação

Ativar gradualmente e monitorar denied/fallback.

---

## 86. Critérios de aprovação

Este documento poderá mudar de `draft` para aprovado quando:

- profiles reais forem inventariados;
- todas as células candidatas forem revisadas;
- cada grant aprovado usar `A`;
- cells `P` forem resolvidas ou adiadas;
- admin bypass tiver política;
- Instrutor tiver fronteira definida;
- capabilities novas tiverem contrato;
- Rules e callables estiverem alinhados;
- testes estiverem definidos;
- migração não ampliar acesso;
- decisão humana estiver registrada.

---

## 87. Próximo documento recomendado

O próximo documento será:

```text
docs/health/web/foundation/HEALTH_WEB_READINESS_POLICY.md
```

Ele deverá traduzir a política canônica de prontidão para a Web, definindo:

- cinco estados oficiais;
- precedência;
- restrições;
- razões;
- freshness;
- conflito;
- comportamento da lista e cockpit;
- ações críticas;
- separação entre projection e autoridade;
- estados técnicos;
- proibição do score legado.

---

## 88. Status

| Item | Estado |
|---|---|
| Perfis considerados | Concluído |
| Permissões genéricas atuais | Documentadas |
| Capabilities canônicas | Incorporadas |
| Matriz Web candidata | Concluída |
| Matriz Mobile candidata | Concluída |
| Evidências | Mapeadas |
| Escopos | Propostos |
| Profiles reais | Não inventariados |
| Grants aprovados | Nenhum novo |
| Admin bypass | Pendente |
| Aprovação para implementação | Não concedida |

---

## 89. Conclusão

A Permission Matrix Web passa a distinguir claramente:

```text
ter acesso técnico
≠
ter capability de negócio
≠
ter autoridade clínica
```

O Operador é candidato natural para execução de campo.

O Gestor é candidato natural para administração Web.

O Instrutor precisa de uma fronteira Health específica.

O Administrador precisa de uma política de suporte que não transforme acesso técnico em decisão clínica.

Nenhuma dessas candidaturas é um grant aprovado nesta versão.

O próximo passo é formalizar como a prontidão canônica será apresentada e protegida na Web.
