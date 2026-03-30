import type { AppState } from '../lib/app-registry';

export type OndeFlowMode = 'EMILIO_ACTIVE' | 'CODER_ACTIVE' | 'IDLE';

export interface CoderSession {
  startedAt: string;
  app: string;
  tasksGiven: string[];
}

export interface OndeFlowState {
  mode: OndeFlowMode;
  activeApp: string | null;
  coderSession: CoderSession | null;
}

let _state: OndeFlowState = {
  mode: 'IDLE',
  activeApp: null,
  coderSession: null
};

export function getOndeFlowState(): OndeFlowState {
  return { ..._state };
}

export function setMode(mode: OndeFlowMode): void {
  _state.mode = mode;
}

export function setActiveApp(app: string | null): void {
  _state.activeApp = app;
}

export function startCoderSession(app: string, tasks: string[]): void {
  _state.mode = 'CODER_ACTIVE';
  _state.coderSession = {
    startedAt: new Date().toISOString(),
    app,
    tasksGiven: tasks
  };
}

export function endCoderSession(): void {
  _state.mode = 'EMILIO_ACTIVE';
}

export function buildCoderBriefing(appState: AppState): string {
  if (_state.coderSession === null) {
    return '';
  }

  const session = _state.coderSession;
  const buildStatus = appState.buildOk === true ? 'OK' : appState.buildOk === false ? 'KO' : 'sconosciuto';
  const lastChange = appState.lastChange ?? 'nessuno';

  return `Il Coder si è fermato all'iterazione ${appState.lastIter}. Build: ${buildStatus}. Ultimo cambiamento: ${lastChange}. Sessione iniziata: ${session.startedAt}.`;
}
