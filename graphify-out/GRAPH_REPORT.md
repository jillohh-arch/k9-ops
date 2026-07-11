# Graph Report - docs  (2026-07-10)

## Corpus Check
- 6 files · ~14,093 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 91 nodes · 118 edges · 18 communities (10 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- OPT Tasks Phase 1
- Health Module & N+1
- Firestore Core
- Listeners & Cleanup
- Dashboard Data
- Optimization Plan
- Vehicle Crews
- Entities Provider
- Code Generators
- Aggregation
- Crew History
- Dual Casing
- Firebase Edition
- Firebase Plan
- Pagination
- Subscriptions

## God Nodes (most connected - your core abstractions)
1. `fs` - 1 edges

## Surprising Connections (you probably didn't know these)
- `FIRESTORE_OPTIMIZATION_PLAN.md` ----> `Firestore`  [EXTRACTED]
   →   _Bridges community 2 → community 5_
- `FIRESTORE_BASELINE.md` ----> `Dashboard`  [EXTRACTED]
   →   _Bridges community 4 → community 5_
- `OPT-FS-107` ----> `Dashboard`  [EXTRACTED]
   →   _Bridges community 4 → community 3_
- `Dashboard` ----> `active_shifts Collection`  [EXTRACTED]
   →   _Bridges community 4 → community 2_
- `Dashboard` ----> `dogs Collection`  [EXTRACTED]
   →   _Bridges community 4 → community 1_

## Import Cycles
- None detected.

## Communities (18 total, 8 thin omitted)

### Community 0 - "OPT Tasks Phase 1"
Cohesion: 0.12
Nodes (17): OPT-FS-103, OPT-FS-112, OPT-FS-109, OPT-FS-110, OPT-FS-118, OPT-FS-111, OPT-FS-102, OPT-FS-116 (+9 more)

### Community 1 - "Health Module & N+1"
Cohesion: 0.22
Nodes (15): health_logs Collection, Health Module, dogs Collection, OPT-FS-119, weight_records Subcollection, binomials Collection, Denormalization, dog-documents Subcollection (+7 more)

### Community 2 - "Firestore Core"
Cohesion: 0.20
Nodes (12): firestore.indexes.json, active_shifts Collection, shift_logs Collection, Web Panel (k9-ops), Firestore, Firebase Console, useReportsData Hook, Mobile App (canil-gcm) (+4 more)

### Community 3 - "Listeners & Cleanup"
Cohesion: 0.25
Nodes (8): Cleanup, onSnapshot, subscribeManyCollections, Memory Leak, React Strict Mode, OPT-FS-107, subscribeCollection, Listeners

### Community 4 - "Dashboard Data"
Cohesion: 0.29
Nodes (8): notifications Collection, shift_groups Collection, user_shift_assignments Collection, occurrences Collection, Dashboard, shift-group-service.ts, useShiftGroups Hook, promotion_requests Collection

### Community 5 - "Optimization Plan"
Cohesion: 0.29
Nodes (7): Phase 2 - Reports, Baseline Measurement, FIRESTORE_BASELINE.md, Phase 3 - N+1, FIRESTORE_OPTIMIZATION_PLAN.md, Phase 4 - Standardization, Phase 0 - Baseline

### Community 6 - "Vehicle Crews"
Cohesion: 0.40
Nodes (6): useCrewMembers Hook, dashboard/page.tsx, OPT-FS-101, vehicle_crews Collection, useOperationalCenterData Hook, members Subcollection

### Community 7 - "Entities Provider"
Cohesion: 0.60
Nodes (5): vehicles Collection, users Collection, useEntities Hook, EntitiesProvider, documents Collection

## Knowledge Gaps
- **1 isolated node(s):** `fs`
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `fs` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `OPT Tasks Phase 1` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._