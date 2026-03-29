// src/services/game-tester.ts

import { execFile, execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { TestScenario, TestStep } from './test-scenarios'

export interface GameTestResult {
  success: boolean
  screenshotPaths: string[]  // absolute paths to screenshots taken
  error?: string
  durationMs: number
}

export async function runGameTest(
  appPath: string,
  scenario: TestScenario,
  screenshotsDir: string,
  onLog?: (msg: string) => void
): Promise<GameTestResult> {
  const startTime = Date.now()
  let screenshotPaths: string[] = []

  try {
    // Ensure screenshots directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }

    const appName = path.basename(appPath, '.app')
    
    // Launch the app
    execFileSync('open', ['-a', appPath], { timeout: 10000 })

    for (const step of scenario.steps) {
      onLog?.(`Executing: ${step.label}`)

      switch (step.action) {
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.duration || 1000))
          break

        case 'screenshot':
          const timestamp = Date.now()
          const filename = `${scenario.name}_${step.label.replace(/\s+/g,'-')}_${timestamp}.png`
          const screenshotPath = path.join(screenshotsDir, filename)
          
          execFileSync('screencapture', ['-x', screenshotPath])
          screenshotPaths.push(screenshotPath)
          break

        case 'key':
          const keyCode = keyNameToKeyCode(step.key || '')
          
          if (step.duration && step.duration > 0) {
            // Press key down
            execFileSync('osascript', ['-e', `tell app "System Events" to key code ${keyCode} using {}`])
            await new Promise(resolve => setTimeout(resolve, step.duration))
            // Release key up
            execFileSync('osascript', ['-e', `tell app "System Events" to key code ${keyCode} using {}`])
          } else {
            execFileSync('osascript', ['-e', `tell app "System Events" to key code ${keyCode} using {}`])
          }
          break

        case 'click':
          if (step.x !== undefined && step.y !== undefined) {
            execFileSync('cliclick', ['c:' + step.x + ',' + step.y])
          }
          break
      }
    }

    // Quit the app
    execFileSync('osascript', ['-e', `tell application "${appName}" to quit`])

    return {
      success: true,
      screenshotPaths,
      durationMs: Date.now() - startTime
    }
  } catch (error) {
    return {
      success: false,
      screenshotPaths: [],
      error: (error as Error).message || 'Unknown error occurred',
      durationMs: Date.now() - startTime
    }
  }
}

function keyNameToKeyCode(key: string): number {
  const mapping: Record<string, number> = {
    'space': 49,
    'right arrow': 124,
    'left arrow': 123,
    'up arrow': 126,
    'down arrow': 125,
    'return': 36,
    'escape': 53
  }

  return mapping[key] || 49
}