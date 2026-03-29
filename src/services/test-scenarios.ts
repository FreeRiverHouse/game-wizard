// src/services/test-scenarios.ts

export interface TestStep {
  action: 'wait' | 'key' | 'screenshot' | 'click'
  duration?: number     // ms for wait/key hold
  key?: string          // key name for osascript (e.g. 'space', 'right arrow')
  x?: number            // for click
  y?: number            // for click
  label: string         // description for logging
}

export interface TestScenario {
  name: string
  steps: TestStep[]
}

export const PGR_GAMEPLAY_SCENARIO: TestScenario = {
  name: 'gameplay-30s',
  steps: [
    { action: 'wait', duration: 3000, label: 'wait for launch' },
    { action: 'key', key: 'space', label: 'start game' },
    { action: 'wait', duration: 2000, label: 'wait for start' },
    { action: 'screenshot', label: 'initial gameplay' },
    { action: 'key', key: 'right arrow', duration: 2000, label: 'steer right' },
    { action: 'screenshot', label: 'after steering right' },
    { action: 'wait', duration: 3000, label: 'mid race' },
    { action: 'screenshot', label: 'mid gameplay' },
    { action: 'wait', duration: 5000, label: 'late race' },
    { action: 'screenshot', label: 'late gameplay' },
  ]
}