@AGENTS.md

## firestore.rules — NÃO é fonte canônica

`firestore.rules` neste repo é um ESPELHO do repo mobile (canil-gcm).
Deploy de rules SEMPRE e SOMENTE do repo mobile
(`firebase deploy --only firestore:rules`). Este repo deploya apenas
`--only hosting`. Nunca editar rules aqui — após alterações no mobile,
copiar o arquivo inteiro para cá e commitar como sync.
