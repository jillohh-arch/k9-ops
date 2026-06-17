# K9-OPS — Manual do Usuário

**Sistema de Gestão Operacional do Canil da Guarda Civil Municipal**
Versão 1.0 | Junho 2026

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Acesso ao Sistema](#acesso-ao-sistema)
3. [Dashboard](#dashboard)
4. [Efetivo K9 (Cães)](#efetivo-k9-cães)
5. [Efetivo Humano (GCMs)](#efetivo-humano-gcms)
6. [Binômios](#binômios)
7. [Viaturas](#viaturas)
8. [Plantões](#plantões)
9. [Central de Ocorrências](#central-de-ocorrências)
10. [Treinamentos](#treinamentos)
11. [Matriz de Prontidão](#matriz-de-prontidão)
12. [Saúde K9](#saúde-k9)
13. [Estoque](#estoque)
14. [Relatórios](#relatórios)
15. [Controle de Acesso](#controle-de-acesso)
16. [Meu Perfil](#meu-perfil)
17. [App Mobile](#app-mobile)
18. [Notificações e Lembretes](#notificações-e-lembretes)
19. [Perfis e Permissões](#perfis-e-permissões)

---

## Visão Geral

O K9-OPS é o sistema integrado de gestão do Canil da GCM. Ele unifica em uma única plataforma:

- Cadastro e acompanhamento de cães, agentes, binômios e viaturas
- Controle de plantões com escala automática (2x2, dias úteis)
- Registro de ocorrências com geolocalização, fotos e assinatura digital
- Acompanhamento de treinamentos e evolução por modalidade
- Gestão de saúde veterinária com alertas automáticos
- Controle de estoque com movimentações e alertas de mínimo
- Relatórios e exportação de dados
- App mobile para operação em campo

O sistema funciona em duas frentes:
- **Web** (https://canil-gcm.web.app): gestão administrativa, cadastros, relatórios
- **Mobile** (APK Android): operação em campo, plantões, ocorrências, treinos

---

## Acesso ao Sistema

### Primeiro acesso
1. O administrador cadastra o agente no módulo Humanos com o e-mail institucional
2. O agente recebe um e-mail de redefinição de senha
3. Ao definir a senha, já pode acessar o sistema web e o app mobile

### Perfis de acesso
O sistema possui 4 perfis pré-configurados:

| Perfil | Quem usa | Escopo |
|--------|----------|--------|
| Administrador | TI / Comando geral | Acesso total |
| Gestor | Inspetor, Subinspetor, Coordenador | Gestão e aprovações |
| Instrutor K9 | Adestradores | Treinos e evolução |
| Operador K9 | Condutores em campo | Operação diária |

---

## Dashboard

A tela inicial exibe um resumo em tempo real da unidade:

### Cards de resumo
- **Efetivo K9**: total de cães ativos
- **Efetivo Humano**: total de agentes ativos
- **Binômios**: total de binômios ativos
- **Viaturas**: total de viaturas disponíveis

### GCMs de serviço hoje
Mostra quais agentes estão escalados para o dia, agrupados por plantão, com horário do turno.

### Ocorrências do período
- Total registradas, finalizadas, em andamento, aguardando assinatura
- Distribuição por natureza

### Drogas apreendidas
Peso totalizado por tipo (maconha, cocaína, crack, ecstasy, outros) no período selecionado.

### Saúde K9
- Prontidão geral (% de cães aptos)
- Cães com pendências (vacina vencida, peso fora da faixa, exame atrasado)

### Pendências abertas
- Ocorrências aguardando assinatura
- Promoções pendentes de aprovação
- Ações pessoais pendentes

### Filtro de período
Selecione entre 7, 15, 30, 60, 90 ou 180 dias para todos os indicadores.

---

## Efetivo K9 (Cães)

**Menu: Efetivo > aba K9** ou diretamente em **/k9**

### Cadastrar novo cão
1. Clique em "Novo K9"
2. Preencha: nome, registro, microchip, raça, sexo, cor, porte
3. Informe data de nascimento, peso atual, faixa de peso ideal
4. Selecione especialidades (Busca & Captura, Detecção, Guarda & Proteção, Obediência)
5. Vincule o condutor (por RA)
6. Faça upload da foto de perfil
7. Salve

### Perfil do cão
Exibe todos os dados cadastrais, histórico de saúde, treinos vinculados e status operacional.

### Filtros disponíveis
- Por status (ativo, em formação, fora de operação)
- Por especialidade
- Por condutor
- Busca textual

### Ações
- Editar dados cadastrais
- Arquivar (com motivo obrigatório)

---

## Efetivo Humano (GCMs)

**Menu: Efetivo > aba Humanos** ou **/humans**

### Cadastrar novo agente
1. Clique em "Novo Agente"
2. Preencha: nome completo, nome de guerra, RA, CPF
3. Informe posto/graduação, função, equipe, unidade
4. Selecione especialidades (Condutor K9, Adestramento, Figuração, Apoio, Veterinário, Administrativo)
5. Defina o perfil de acesso
6. Salve

### Perfil do agente
- Dados pessoais e funcionais
- Certificações (cursos, habilitações)
- Documentos anexados
- Movimentações funcionais (transferências, licenças, afastamentos)
- Histórico de ocorrências e treinos

### Gestão de acesso (no perfil)
- Ativar/desativar conta
- Atribuir/remover role de Instrutor K9
- Enviar redefinição de senha

### Certificações
- Cadastre cursos e habilitações com validade
- Anexe comprovantes (PDF, imagem)
- Acompanhe vencimentos

### Movimentações
- Registre transferências, afastamentos, licenças
- Defina impacto operacional
- Acompanhe datas de início e retorno previsto

---

## Binômios

**Menu: Efetivo > aba Binômios** ou **/binomials**

Binômio = a dupla formada por um condutor e um cão.

### Cadastrar binômio
1. Selecione o cão
2. Selecione o condutor
3. Defina a especialidade primária
4. Defina o status (Ativo, Em formação)
5. Salve

### Indicadores automáticos
- **Score de prontidão**: calculado com base em treinos e saúde
- **Score de sinergia**: evolução conjunta condutor + cão
- **Estágio**: operacional, em formação, vinculado, em plantão, encerrado

### Filtros
- Por status, especialidade, busca textual

---

## Viaturas

**Menu: Efetivo > aba Viaturas** ou **/vehicles**

### Cadastrar viatura
1. Clique em "Nova Viatura"
2. Preencha: prefixo, placa, RENAVAM, chassi
3. Informe marca, modelo, ano, cor, combustível
4. Defina km atual, capacidade, base
5. Informe validades (CRLV, licenciamento, seguro)
6. Salve

### Eventos de viatura
Registre manutenções, abastecimentos, revisões:
- Tipo de evento, data, responsável
- Odômetro, custo, fornecedor
- Notas e anexos

### Alertas automáticos
- Revisão vencida/próxima
- CRLV a vencer
- Km acima do previsto para revisão

---

## Plantões

**Menu: Plantões** ou **/shifts**

### Criar grupo de plantão
1. Clique em "Novo Plantão"
2. Defina: nome (ex: Alfa, Bravo), código
3. Selecione tipo: Operacional ou Administrativo
4. Selecione escala:
   - **2x2**: trabalha 2 dias, folga 2 (padrão GCM)
   - **Segunda a sexta**: expediente administrativo
5. Defina horário de início e fim do turno
6. Defina a data-âncora (referência para o ciclo)
7. Defina o padrão de trabalho (quais dias do ciclo são de serviço)
8. Configure notificações (lembrete antes, no fim, e em atraso)
9. Salve

### Vincular GCMs ao plantão
1. Abra o plantão desejado
2. Clique no ícone de membros (Users)
3. No modal, busque e selecione os agentes
4. Salve — a atribuição é imediata

### Visualização
- Cards por plantão com contagem de membros
- Badge indicando próximo turno
- Filtros por tipo, status e escala

### Notificações automáticas
O sistema envia push para o celular dos GCMs escalados:
- **Antes do turno**: "Seu turno começa em X minutos"
- **No encerramento**: "Seu turno encerra agora"
- **Em atraso**: "Turno em atraso há X minutos, finalize ou justifique"

---

## Central de Ocorrências

**Menu: Central** ou **/occurrences**

Painel operacional em tempo real que mostra:

- Ocorrências ativas com status, natureza e prioridade
- Binômios em serviço
- Viaturas em uso
- Distribuição por natureza (gráfico)
- Timeline de registros recentes
- Fila de atenção do gestor
- Integridade documental (% selado)

### Fluxo de ocorrência (via mobile)
1. GCM inicia ocorrência no app
2. Seleciona natureza, registra localização
3. Adiciona participantes à equipe
4. Registra ações, anexa fotos
5. Finaliza com relatório
6. Sistema gera hash de integridade
7. Solicita assinaturas dos participantes
8. Ocorrência é selada e fica disponível para exportação

---

## Treinamentos

**Menu: Treinamentos** ou **/training**

### Painel geral
- Sessões recentes por modalidade
- Taxa de aproveitamento
- Cães com pendência de evolução
- Próximas evoluções sugeridas

### Modalidades
- Busca & Captura
- Detecção
- Guarda & Proteção
- Obediência

### Currículos (/training/curriculums)
Defina programas de treinamento estruturados:
1. Crie um programa por modalidade
2. Adicione módulos (níveis progressivos)
3. Defina marcos (milestones) em cada módulo
4. Configure critérios de promoção:
   - Sessões mínimas
   - Taxa de sucesso mínima
   - Distância mínima percorrida
   - Eventos esperados

### Promoções de nível
Quando um cão atinge todos os critérios, o instrutor pode solicitar promoção. O gestor aprova ou rejeita.

---

## Matriz de Prontidão

**Menu: Prontidão K9** ou **/training-matrix**

Visão matricial: cada cão × cada modalidade × cada módulo do currículo.

Para cada célula mostra:
- Nível atual no currículo
- % de critérios atendidos
- Marcos atingidos / total
- Sessões completas / exigidas
- Taxa de sucesso / mínima
- Distância acumulada / mínima
- Status: pronto para evolução, em progresso ou bloqueado

---

## Saúde K9

**Menu: Saúde** ou **/health**

### Hub de registro
Registre eventos de saúde:
- Vacinação (com próxima dose prevista)
- Exame veterinário
- Consulta
- Antiparasitário
- Medicação
- Cirurgia
- Sintoma observado

### Campos de cada evento
- Tipo, subtipo, data, próxima data prevista
- Veterinário (nome, clínica, CRMV)
- Custo, observações
- Anexo (até 20MB)

### Registro de peso
- Peso em kg, data da medição
- Contexto (jejum, pós-refeição)

### Alertas automáticos
O dashboard sinaliza:
- Vacina vencida ou vencendo em breve
- Exame atrasado (>180 dias)
- Peso fora da faixa ideal cadastrada

---

## Estoque

**Menu: Estoque** ou **/inventory**

### Abas

**Consulta**: visualize saldos atuais e alertas de estoque mínimo.

**Movimentação**: registre entradas, saídas, ajustes, perdas, descartes e vencimentos.

**Catálogo**: gerencie itens e categorias.

### Cadastrar item
1. Acesse a aba Catálogo
2. Clique em "Novo Item"
3. Preencha: nome, categoria, unidade de medida
4. Defina estoque mínimo
5. Salve

### Registrar movimentação
1. Acesse a aba Movimentação
2. Selecione o item
3. Escolha o tipo (entrada, saída, ajuste, etc.)
4. Informe quantidade e justificativa
5. Salve — o saldo é atualizado automaticamente

### Unidades de medida disponíveis
kg, pacote, unidade, caixa, frasco, comprimido, metro, par

---

## Relatórios

**Menu: Relatórios** ou **/reports**

10 relatórios especializados com filtro por período:

| Relatório | O que mostra |
|-----------|-------------|
| Ocorrências | Volume, naturezas, tempos, finalização |
| Apreensões | Drogas por tipo/peso, armas, outros |
| Efetivo | Disponibilidade, movimentações, cobertura |
| Binômios | Prontidão, atividade, sinergias |
| Viaturas | Uso, manutenções, custos, disponibilidade |
| Saúde | Vacinas, exames, pesos, pendências |
| Treinos | Sessões, evolução, taxa de sucesso |
| Estoque | Consumo, saldos, alertas, movimentações |
| Auditoria | Integridade, assinaturas, logs, alterações |
| Produtividade | Ocorrências/binômio, cobertura, métricas |

Todos os relatórios possuem exportação de dados e podem ser assinados digitalmente.

---

## Controle de Acesso

**Menu: Acesso** ou **/access**

Gerencie quem pode fazer o quê no sistema.

### Visualizar perfis
Veja os perfis existentes com suas permissões resumidas.

### Editar permissões
Na aba "Permissões", ajuste a matriz módulo × ação para cada perfil.

### Gerenciar usuários
Na aba "Usuários", veja quem está vinculado a cada perfil e faça atribuições.

### Ações disponíveis por módulo
- Visualizar, Criar, Editar, Arquivar, Exportar, Aprovar, Auditar

### Criar novo perfil
1. Clique em "Novo Perfil"
2. Defina nome, nível, escopo
3. Configure a matriz de permissões
4. Salve

---

## Meu Perfil

**Ícone do usuário no canto superior** ou **/me**

- Veja seus dados pessoais e funcionais
- Consulte o K9 vinculado a você
- Veja seus treinos recentes
- Consulte suas ocorrências
- Acesse seus documentos
- Verifique informações de segurança (claims, perfil)

---

## App Mobile

O app Android é usado pelos GCMs em campo para:

### Assumir plantão
1. Abra o app e toque em "Assumir Turno"
2. Selecione o cão para o plantão
3. Opcionalmente selecione a viatura
4. O sistema verifica aptidão do cão
5. Confirme — o plantão é iniciado

### Durante o plantão
- Registre ocorrências com geolocalização e fotos
- Registre sessões de treino com GPS tracking (rota, distância, duração)
- Registre eventos de saúde
- Troque de cão se necessário
- Gerencie tripulação da viatura (convidar/aceitar membros)

### Ocorrências (no mobile)
1. Toque em "Nova Ocorrência"
2. Selecione a natureza (busca semântica)
3. Registre localização (GPS automático + edição manual)
4. Adicione equipe participante
5. Anexe fotos (com hash de integridade)
6. Finalize com relatório
7. Solicite assinaturas digitais
8. A ocorrência é selada automaticamente

### Encerrar plantão
1. No painel do turno ativo, toque em "Encerrar"
2. O sistema registra o horário e notifica a conclusão

### Notificações push
O app recebe automaticamente:
- Lembrete antes do turno começar
- Aviso no fim do turno
- Alerta quando o turno está em atraso

---

## Notificações e Lembretes

O sistema envia notificações automáticas via push (mobile) e registra no painel web:

### Plantões
- Início do turno (X minutos antes)
- Fim do turno (no horário)
- Atraso (quando ultrapassa o horário previsto)

### Saúde
- Vacinas vencendo/vencidas (indicador no dashboard)
- Exames atrasados

### Operacional
- Ocorrências aguardando assinatura
- Promoções pendentes de aprovação
- Convites de tripulação de viatura

### Central de notificações
No ícone do sino (header), veja todas as notificações não lidas com ações disponíveis.

---

## Perfis e Permissões — Referência Rápida

### Administrador
Acesso total a todos os módulos. Pode criar/editar outros perfis, auditar registros, aprovar promoções.

### Gestor (Inspetor / Subinspetor / Coordenador)
- Visualiza, cria, edita e arquiva em todos os módulos operacionais
- Pode exportar e aprovar
- Gerencia plantões e escalas
- Acessa relatórios completos

### Instrutor K9
- Foco em treinamentos: cria sessões, propõe evoluções
- Visualiza e edita cães, binômios, saúde
- Pode registrar eventos de saúde e peso
- Gerencia currículos e matriz de prontidão

### Operador K9 (Condutor)
- Opera via app mobile: assume plantão, registra ocorrências e treinos
- Visualiza seu próprio perfil, cão vinculado e histórico
- Pode criar ocorrências e treinos
- Acesso limitado ao escopo dos próprios registros

---

## Suporte

- **URL do sistema**: https://canil-gcm.web.app
- **Projeto Firebase**: canil-gcm
- **Região**: southamerica-east1 (São Paulo)

Para problemas de acesso, entre em contato com o administrador do sistema para redefinição de senha ou ajuste de permissões.

---

*K9-OPS v1.0 — Desenvolvido para a Guarda Civil Municipal*