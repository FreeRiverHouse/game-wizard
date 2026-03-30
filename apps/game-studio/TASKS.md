# Game Studio — Tasks

## In Progress
- [ ] Onde-Flow integration: state machine EMILIO ↔ CODER
- [ ] Ocean scene UI per Emilio

## Backlog
- [ ] Tester bot: lancia il gioco, gioca, cattura screenshot gameplay reale
- [ ] Planner autonomo: genera obiettivi dal DB iterazioni
- [ ] Multi-game support: registra qualsiasi gioco nel DB
- [ ] Game templates: Unity-CS, Godot-GDScript, Web-JS
- [ ] Builder system: parametri editabili via UI
- [ ] Vision model upgrade: Qwen2.5-VL 7B download + test
- [ ] Loop autonomous mode: 3+ iterazioni consecutive no changes → stop

## Done
- [x] Loop base: build → screenshot → analyze → code → commit
- [x] Model orchestrator: carica/scarica modelli sequenzialmente
- [x] LangGraph graph: wizard state machine
- [x] Shop/Emilio NPC: chat con Claude via CLI
- [x] Pipeline visualization: Emilio → Planner → Coder → Vision
- [x] Bot tester: 5 scenari automatici in italiano
- [x] Rename Gino → Emilio
- [x] action:create_game → LangGraph trigger
