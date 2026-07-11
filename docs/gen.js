const fs = require('fs');
let md = '';
function L(s=''){md += s + '\n';}
function T(s=''){md += s;}

// Header
L('# Firestore Schema \u2014 Dom\u00ednio de Turnos, Equipes e Viaturas');
L();
L('> **Projeto:** K9 Ops (Web Admin) + Canil GCM (Mobile)');
L('> **\u00daltima atualiza\u00e7\u00e3o:** 2026-07-10');
L('> **Escopo:** Cole\u00e7\u00f5es `active_shifts`, `vehicle_crews`, `shift_logs`, `vehicle_crew_history`, `shift_groups`, `user_shift_assignments`, `vehicles`');
L('> **Fonte can\u00f4nica de rules:** repo mobile (`canil-gcm`)');
L();
L('---');
L();
