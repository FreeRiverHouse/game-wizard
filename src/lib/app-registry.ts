import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  name: string;
  path: string;
  color: string;
  icon: string;
  description: string;
}

export interface AppState {
  lastIter: number;
  buildOk: boolean | null;
  lastChange: string | null;
  coderStopped: boolean;
  timestamp: string | null;
}

export const APP_REGISTRY: AppConfig[] = [
  {
    name: 'game-studio',
    path: 'apps/game-studio',
    color: '#00d4ff',
    icon: '⊞',
    description: 'Pizza Gelato Rush self-improvement loop'
  },
  {
    name: 'book-wizard',
    path: 'apps/book-wizard',
    color: '#a855f7',
    icon: '◫',
    description: 'Book editing and publishing workflow'
  }
];

export function listApps(): AppConfig[] {
  return APP_REGISTRY;
}

export function getAppState(name: string): AppState {
  const defaultState: AppState = {
    lastIter: 0,
    buildOk: null,
    lastChange: null,
    coderStopped: false,
    timestamp: null
  };

  const statePath = path.join(process.cwd(), 'apps', name, 'STATE.json');

  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(content) as AppState;
    return parsed;
  } catch {
    return defaultState;
  }
}

export function updateAppState(name: string, state: Partial<AppState>): void {
  const currentState = getAppState(name);
  const merged: AppState = { ...currentState, ...state };

  const appsDir = path.join(process.cwd(), 'apps', name);
  const statePath = path.join(appsDir, 'STATE.json');

  fs.mkdirSync(appsDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(merged, null, 2), 'utf-8');
}

export function getAppContext(name: string): string {
  const visionPath = path.join(process.cwd(), 'apps', name, 'VISION.md');
  const tasksPath = path.join(process.cwd(), 'apps', name, 'TASKS.md');

  let visionContent = '';
  let tasksContent = '';

  try {
    visionContent = fs.readFileSync(visionPath, 'utf-8');
  } catch {
    // Skip if file missing
  }

  try {
    tasksContent = fs.readFileSync(tasksPath, 'utf-8');
  } catch {
    // Skip if file missing
  }

  let result = '';

  if (visionContent) {
    result += '=== VISION ===\n' + visionContent;
  }

  if (tasksContent) {
    if (result) {
      result += '\n\n';
    }
    result += '=== TASKS ===\n' + tasksContent;
  }

  return result;
}
