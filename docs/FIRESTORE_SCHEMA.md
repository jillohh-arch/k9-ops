# Firestore Schema — K9 Ops

> **Projeto:** K9 Ops (Web) + Canil GCM (Mobile Flutter)
> **Firebase Project:** canil-gcm | **Região:** southamerica-east1
> **Gerado em:** 2026-07-10 | **Commits:** web efeee49, mobile HEAD
> **Fonte canônica de rules:** repo mobile (canil-gcm)

---

## 1. Objetivo e escopo

Schema real implementado no domínio de **turnos, equipes de viatura e K9 em serviço**. Contrato entre:

- App mobile Flutter (escritor principal de shifts/crews)
- Painel web Next.js (leitor + admin de shift_groups)
- Cloud Functions (invitations, reminders, vehicle admin)
- Firestore Security Rules (2140 linhas, deploy do repo mobile)

**Escopo:** active_shifts, vehicle_crews, shift_logs, vehicle_crew_history, shift_groups, user_shift_assignments, vehicles.

---

## 2. Convenções

### IDs de documentos

| Coleção | Padrão de ID | Exemplo |
|---------|-------------|---------|
| active_shifts/{ra} | RA do agente | 12345 |
| vehicle_crews/{crewId} | = vehicleId | vtr-001 |
| vehicle_crews/{crewId}/members/{ra} | RA do agente | 12345 |
| shift_logs/{shiftId} | UUID auto-gerado | abc-def-123 |
| vehicle_crew_history/{id} | Auto-gerado | xyz789 |
| shift_groups/{groupId} | Auto-gerado | sg-001 |
| user_shift_assignments/{id} | Auto-gerado | usa-001 |
| vehicles/{vehicleId} | Definido pelo admin | vtr-001 |

### Nomenclatura dual (snake_case + camelCase)

Campos gravados em AMBAS as convenções para compatibilidade mobile/web:
- createdAt + created_at
- shiftGroupId + shift_group_id
- updatedAt + updated_at

Leitura usa fallback chains em ambas plataformas.

### null vs campo ausente vs string vazia

- **Ausente:** campo opcional nunca preenchido
- **null:** campo explicitamente removido (ex: service_dog_id após dissociação)
- **FieldValue.delete():** usado em dissociateDog
- **String vazia:** fallback para dogId quando sem K9

---

## 3. Visão geral das coleções

| Coleção | Escritor | Leitor | Docs estimados |
|---------|----------|--------|---------------|
| active_shifts | Mobile | Mobile + Web | ~5-50 ativos |
| vehicle_crews | Mobile + Functions | Mobile + Web | ~3-20 ativas |
| members (sub) | Mobile + Functions | Mobile + Web | ~2-6 por crew |
| shift_logs | Mobile + Functions | Web | crescente |
| vehicle_crew_history | Mobile | Web | crescente |
| shift_groups | Web admin | Todos | ~5-15 |
| user_shift_assignments | Web admin | Todos | ~30-80 |
| vehicles | Functions (Admin SDK) | Todos | ~10-30 |


---

## 4. Schema detalhado por coleção

### 4.1 active_shifts/{ra}

**Finalidade:** Estado em tempo real do turno individual.
**Doc ID:** RA (matrícula) do agente.
**Criado por:** Mobile (startShift — WriteBatch).
**Atualizado por:** Mobile (transações) + Functions (respondVehicleCrewInvitation).
**Removido:** Nunca. Permanece com status: ended.

| Campo | Tipo | Req | Escrita | Observações |
|-------|------|:---:|---------|-------------|
| shiftId | string | ✓ | Mobile | Ref para shift_logs/{shiftId} |
| handlerId | string | ✓ | Mobile | = doc ID (RA) |
| auth_uid | string | ✓ | Mobile | UID Firebase Auth |
| handler_email | string | ✓ | Mobile | Email do agente |
| shift_group_id | string | | Mobile | ID do grupo de escala |
| shift_group_code | string | | Mobile | Código curto |
| shift_group_label | string | | Mobile | Nome da escala |
| dogId | string | ✓ | Mobile | K9 atual (ou vazio) |
| service_dog_id | string | | Mobile | Canônico do K9 em serviço |
| status | string | ✓ | Mobile | active ou ended |
| startedAt | Timestamp | ✓ | Mobile | Início do turno |
| updatedAt | Timestamp | ✓ | Mobile | Última alteração |
| lastDogSwitchAt | Timestamp | | Mobile | Último switch de K9 |
| endedAt | Timestamp | | Mobile | Encerramento |
| vehicle_id | string | | Mobile+Fn | Viatura assumida |
| vehicle_label | string | | Mobile+Fn | Label viatura |
| vehicle_prefix | string | | Mobile+Fn | Prefixo viatura |
| vehicle_model | string | | Mobile+Fn | Modelo |
| vehicle_unit | string | | Mobile+Fn | Unidade |
| vehicle_joined_at | Timestamp | | Mobile+Fn | Entrada na viatura |
| vehicle_crew_id | string | | Mobile+Fn | ID crew (= vehicle_id) |
| crew_id | string | | Functions | Alias de vehicle_crew_id |
| crew_role | string | | Mobile+Fn | Função na equipe |
| crew_status | string | | Mobile+Fn | Status na equipe |

**Enums:** status: active, ended | crew_role: motorista, encarregado, auxiliar_1, auxiliar_2, k9

**Índice composto:** vehicle_id ASC + started_at DESC

---

### 4.2 vehicle_crews/{crewId}

**Finalidade:** Equipe ativa vinculada a uma viatura.
**Doc ID:** = vehicleId (confirmado: _crewIdFor(vehicleId) => vehicleId.trim()).
**Criado por:** Mobile (primeiro agente a entrar cria a crew).
**Atualizado por:** Mobile + Functions (adminUpsertVehicle propaga label/prefix).
**Encerrado por:** Mobile (último membro sai) ou Functions (recalculateCrewActiveStatus).

| Campo | Tipo | Req | Escrita | Observações |
|-------|------|:---:|---------|-------------|
| id | string | ✓ | Mobile | = doc ID = vehicle_id |
| vehicle_id | string | ✓ | Mobile | IMUTÁVEL após criação |
| vehicle_label | string | ✓ | Mobile+Fn | Atualizado por admin |
| vehicle_prefix | string | | Mobile+Fn | Prefixo |
| vehicle_model | string | | Mobile+Fn | Modelo |
| vehicle_unit | string | | Mobile+Fn | Unidade |
| crew_size | number | ✓ | Mobile | IMUTÁVEL - capacidade |
| service_dog_id | string | | Mobile | K9 da equipe |
| titular_handler_id | string | ✓ | Mobile | RA do titular |
| active | boolean | ✓ | Mobile+Fn | Em operação |
| created_at | Timestamp | ✓ | Mobile | Criação |
| updated_at | Timestamp | ✓ | Mobile+Fn | Atualização |
| ended_at | Timestamp | | Mobile+Fn | Encerramento |
| dog_changes | array | | Mobile | Histórico trocas K9 |

**Rules:** Apenas titular pode atualizar crew ativa. vehicle_id e crew_size imutáveis.

---

### 4.3 vehicle_crews/{crewId}/members/{ra}

**Finalidade:** Integrante de equipe.
**Doc ID:** RA do agente.
**Criado por:** Mobile + Functions (invitation flow).

| Campo | Tipo | Req | Escrita | Observações |
|-------|------|:---:|---------|-------------|
| handler_id | string | ✓ | Mobile+Fn | = doc ID |
| auth_uid | string | | Mobile+Fn | UID Auth |
| handler_email | string | | Mobile+Fn | Email |
| name | string | | Mobile | Nome display |
| role | string | ✓ | Mobile+Fn | Função |
| status | string | ✓ | Mobile+Fn | Estado |
| dog_id | string | | Mobile | K9 deste membro |
| joined_at | Timestamp | ✓ | Mobile+Fn | Entrada |
| left_at | Timestamp | | Mobile | Saída |
| updated_at | Timestamp | | Mobile+Fn | Atualização |
| invited_at | Timestamp | | Functions | Convite |
| invited_by | string | | Functions | RA convidante |
| responded_at | Timestamp | | Mobile+Fn | Resposta |
| decline_reason | string | | Mobile+Fn | Motivo recusa |

**Enums role:** titular, motorista, encarregado, auxiliar_1, auxiliar_2, k9
**Enums status:** active, ended, pending, declined, cancelled

---

### 4.4 shift_logs/{shiftId}

**Finalidade:** Registro histórico completo do turno.
**Doc ID:** UUID gerado no startShift.
**Criado por:** Mobile (WriteBatch). **Atualizado por:** Mobile (merge) + Functions.

Campos: id, handlerId, auth_uid, handler_email, shift_group_*, initialDogId, currentDogId, service_dog_id, status, startedAt, endedAt, dogSwitches(array), vehicleChanges(array), createdAt, updatedAt, vehicle_*, crew_*

---

### 4.5 vehicle_crew_history/{id}

**Finalidade:** Snapshot imutável ao encerrar equipe.
**Criado por:** Mobile (_writeCrewHistorySnapshot em transação).
**Nunca atualizado.**

Campos: id, vehicle_id, vehicle_label, vehicle_prefix, vehicle_model, period({started_at, ended_at}), members([{handler_id, role, joined_at, left_at, dog_id}]), dog_changes, ended_by, shift_ids, created_at

---

### 4.6 shift_groups/{groupId}

**Finalidade:** Definição de escala. **Criado por:** Web admin.

Campos: active, code, name, type(operational|administrative), scheduleType(two_by_two|weekdays|custom), expectedStartHour, expectedEndHour, municipality, anchorDate, workPattern, notifications(map), createdAt, updatedAt

---

### 4.7 user_shift_assignments/{id}

**Finalidade:** Vínculo agente para escala. **Criado por:** Web admin (WriteBatch).

Campos: active, userId/user_id/user_ra, shiftGroupId/shift_group_id, shiftGroupLabel/shift_group_label, assignedAt/assigned_at, endedAt/ended_at

---

### 4.8 vehicles/{vehicleId}

**Finalidade:** Cadastro de viaturas (somente leitura para clientes).
**Criado por:** Cloud Functions (adminUpsertVehicle).
**Rules:** allow create, update, delete: if false (Admin SDK only).

Campos: active, name, prefix, model, unit, crew_size, brand, plate, year, fuel, mileageKm, status, maintenanceStatus, base, photoUrl. Subcoleções: events/{eventId}, documents/{docId}.


---

## 5. Domínio de turnos e equipes

\
### Invariante chave: crewId === vehicleId

Confirmado no código mobile: _crewIdFor(vehicleId) => vehicleId.trim()

---

## 6. Fonte oficial de cada informação

| Pergunta | Fonte oficial | Documento |
|----------|--------------|-----------|
| Equipe está ativa? | vehicle_crews/{vehicleId}.active | Crew doc |
| Viatura do agente? | active_shifts/{ra}.vehicle_id | Shift doc |
| Membros atuais da equipe? | vehicle_crews/{id}/members where status==active | Subcoleção |
| Função de cada integrante? | vehicle_crews/{id}/members/{ra}.role | Member doc |
| Titular da equipe? | vehicle_crews/{id}.titular_handler_id | Crew doc |
| K9 em serviço (equipe)? | vehicle_crews/{id}.service_dog_id | Crew doc |
| K9 em serviço (individual)? | active_shifts/{ra}.service_dog_id | Shift doc |
| Condutor vinculado ao K9? | vehicle_crews/{id}/members/{ra}.dog_id | Member doc |
| Mobile consulta? | active_shifts/{ra} + vehicle_crews/{crewId} | Ambos |
| Web consulta? | Mesmas coleções via onSnapshot | Ambos |
| Relação shifts/crews? | active_shifts.vehicle_crew_id aponta para vehicle_crews | Referência |
| Dados duplicados? | vehicle_label, service_dog_id, crew_role em ambos | Shift + Crew |
| Precedência se divergir? | vehicle_crews = autoritativo para crew; active_shifts = autoritativo para turno individual | Por domínio |

### Dados duplicados entre documentos

| Campo | active_shifts | vehicle_crews | members | Motivo |
|-------|:---:|:---:|:---:|--------|
| vehicle_label | ✓ | ✓ | | Evitar join para exibição |
| vehicle_prefix | ✓ | ✓ | | Idem |
| service_dog_id | ✓ | ✓ | | Consulta rápida por agente e por equipe |
| crew_role | ✓ | | ✓ (como role) | Estado individual vs coletivo |
| dog_id | ✓ (dogId) | | ✓ | K9 por agente e por membro |
| handler_email | ✓ | | ✓ | Comunicação sem join extra |

---

## 7. Fluxos de leitura e escrita

### Fluxo 1: Assumir turno sem equipe

\
- **Mecanismo:** WriteBatch (sem leituras transacionais)
- **Risco:** Validação de capacidade FORA do batch — race condition possível

### Fluxo 2: Entrar em equipe ativa (assumeVehicle)

- **Mecanismo:** runTransaction
- **Leituras antes:** active_shifts query (capacidade), members query (role livre)
- **Leituras dentro:** active_shifts/{ra}, vehicle_crews/{crewId} (2x)
- **Escritas:** active_shifts/{ra}, shift_logs/{shiftId}, vehicle_crews (condicional), members/{ra}
- **Risco:** Capacidade validada fora da transação

### Fluxo 3: Transferir para outra viatura

- **Mecanismo:** runTransaction (3 fases)
- **Fase 1:** Lê active_shifts (shiftId, previousCrewId)
- **Fase 2:** Lê members/crew da equipe anterior (para snapshot)
- **Fase 3:** Transação atômica
- **Escritas:** old members (ended), old crew (close se último), history (se fechou), active_shifts (nova viatura), shift_logs, new crew, new members
- **Risco:** TOCTOU — leituras fora da transação

### Fluxo 4: Associar K9 (associateDog)

- **Mecanismo:** runTransaction
- **Leituras dentro:** active_shifts/{ra}, vehicle_crews/{crewId}, dogs/{dogId}
- **Leitura NÃO transacional:** Query vehicle_crews where active==true AND service_dog_id==dogId
- **Escritas:** members/{ra} (dog_id), vehicle_crews (service_dog_id), active_shifts (dogId)
- **Risco CRÍTICO:** Verificação cross-crew NÃO é transacional — race condition

### Fluxo 5: Dissociar K9 (dissociateDog)

- **Mecanismo:** runTransaction
- **Escritas:** members/{ra} (delete dog_id), vehicle_crews (delete service_dog_id se era o dog da crew), active_shifts (delete dogId)

### Fluxo 6: Sair da equipe (leaveVehicle)

- **Mecanismo:** runTransaction
- **Escritas:** members/{ra} (ended), vehicle_crews (delete service_dog_id se tinha dog), active_shifts (null campos viatura), shift_logs (null campos viatura)
- **BUG:** NÃO fecha a crew mesmo se for o último membro. Crew fica active:true sem membros.

### Fluxo 7: Encerrar turno (endShift)

\
### Fluxo 8: Convite via Cloud Functions

- inviteVehicleCrewMember: transação, cria members/{handlerId} com status:pending
- respondVehicleCrewInvitation: transação, atualiza member + active_shifts + shift_logs (accept)
- cancelVehicleCrewInvitation: transação, member status:cancelled

### Fluxo 9: Operação concorrente

- Dois agentes no mesmo veículo: Capacidade validada FORA do batch/transação. Pode exceder crew_size.
- Mesmo K9 em duas crews: Verificação cross-crew NÃO transacional. Janela de race condition.

---

## 8. Invariantes de consistência

| Invariante | Enforced? | Mecanismo | Observação |
|------------|:---------:|-----------|------------|
| Um active_shift por agente | ✓ | Doc ID = RA | Design garante |
| Um membro ativo por crew por agente | ✓ | Doc ID = RA | Design garante |
| Uma crew ativa por agente | ✗ | Nenhum | Agente pode existir em múltiplas crews |
| Role único na crew | Parcial | Query _validateRoleIsFree | Fora da transação |
| Titular não sobrescrito | ✓ | Rules | titular_handler_id imutável em crew ativa |
| K9 vinculado a turno válido | ✓ | Transaction | associateDog verifica shift ativo |
| Crew fecha ao perder todos membros | Parcial | endShift/transfer sim, leaveVehicle NÃO | Bug |
| Capacidade respeitada | Parcial | Query antes do batch | Race condition |
| K9 em uma só crew | Parcial | Query NÃO transacional | Race condition |

---

## 9. Integração mobile e web

| Operação | Mobile | Web |
|----------|--------|-----|
| Criar turno | ✓ (startShift) | ✗ |
| Entrar em equipe | ✓ (assumeVehicle) | ✗ |
| Associar K9 | ✓ (associateDog) | ✗ |
| Encerrar turno | ✓ (endShift) | ✗ |
| Convidar membro | ✗ | ✗ (via Cloud Function) |
| Gerenciar escalas | ✗ | ✓ (shift_groups) |
| Gerenciar viaturas | ✗ | ✓ (via Cloud Function) |
| Visualizar crews | ✓ (listener) | ✓ (listener) |
| Visualizar turnos | ✓ (por RA) | ✓ (coleção toda) |

