# Game Studio — Vision

## Cos'è
Game Studio è il modulo di Onde-Flow dedicato allo sviluppo autonomo di videogiochi.
Il sistema usa un loop di self-improvement AI-driven: build → screenshot → analisi visiva → generazione codice → commit.

## Progetto attuale: Pizza Gelato Rush (PGR)
Un endless runner 3D in Unity ambientato a Napoli. Il giocatore guida uno scooter consegnando pizze e gelati tra vicoli colorati.

## Obiettivo a lungo termine
- Loop autonomo che migliora il gioco senza intervento umano
- Support multi-gioco (qualsiasi engine: Unity, Godot, web)
- Tester bot che gioca davvero e cattura screenshot di gameplay reale
- Planner AI che genera obiettivi da solo basandosi sulla storia delle iterazioni

## Stack tecnico
- Unity 2023 URP (C#)
- Qwen3-Coder 30B via LM Studio (code generation)
- Qwen2.5-VL 7B (vision analysis)
- LangGraph TypeScript (orchestrazione)
- Next.js dashboard (controllo)
