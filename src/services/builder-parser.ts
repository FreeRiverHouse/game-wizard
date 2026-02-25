import fs from 'node:fs'
import path from 'node:path'
import { BUILDERS_DIR, CORE_DIR, BUILDER_CATEGORIES, GAME_PATH } from '@/lib/constants'
import type { BuilderParam, BuilderInfo } from '@/lib/types'

// ── Pattern regex per estrarre parametri dai file C# ──
// Matcha righe tipo:
//   public static float HeightMin = 7f;
//   static readonly Color PoleColor = new Color(0.64f, 0.46f, 0.18f);
//   static Color AsphaltA = new Color(0.34f, 0.34f, 0.38f);
//   public static int Segments = 80;
//   public static bool DetailLOD = true;
//   Color frameColor = new Color(0.16f, 0.54f, 0.92f);  (instance, BicycleVisuals)

const FLOAT_PATTERN = /^(\s*)(public\s+)?static\s+(readonly\s+)?float\s+(\w+)\s*=\s*([^;]+);/
const INT_PATTERN   = /^(\s*)(public\s+)?static\s+(readonly\s+)?int\s+(\w+)\s*=\s*([^;]+);/
const BOOL_PATTERN  = /^(\s*)(public\s+)?static\s+(readonly\s+)?bool\s+(\w+)\s*=\s*([^;]+);/
const COLOR_STATIC_PATTERN   = /^(\s*)(public\s+)?static\s+(readonly\s+)?Color\s+(\w+)\s*=\s*new\s+Color\(([^)]+)\);/
const COLOR_INSTANCE_PATTERN = /^(\s*)Color\s+(\w+)\s*=\s*new\s+Color\(([^)]+)\);/

/**
 * Parsa un singolo file C# e ritorna la lista di parametri modificabili.
 */
export function parseBuilderFile(filePath: string): BuilderParam[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const params: BuilderParam[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const trimmed = line.trim()

    // Skip commenti e righe XML doc
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('///')) continue

    // Float
    let m = line.match(FLOAT_PATTERN)
    if (m) {
      params.push({
        name: m[4],
        type: 'float',
        value: m[5].trim(),
        line: lineNum,
        access: `${m[2] || ''}static${m[3] ? ' readonly' : ''}`.trim(),
      })
      continue
    }

    // Int
    m = line.match(INT_PATTERN)
    if (m) {
      params.push({
        name: m[4],
        type: 'int',
        value: m[5].trim(),
        line: lineNum,
        access: `${m[2] || ''}static${m[3] ? ' readonly' : ''}`.trim(),
      })
      continue
    }

    // Bool
    m = line.match(BOOL_PATTERN)
    if (m) {
      params.push({
        name: m[4],
        type: 'bool',
        value: m[5].trim(),
        line: lineNum,
        access: `${m[2] || ''}static${m[3] ? ' readonly' : ''}`.trim(),
      })
      continue
    }

    // Color (static / static readonly)
    m = line.match(COLOR_STATIC_PATTERN)
    if (m) {
      params.push({
        name: m[4],
        type: 'Color',
        value: m[5].trim(),
        line: lineNum,
        access: `${m[2] || ''}static${m[3] ? ' readonly' : ''}`.trim(),
      })
      continue
    }

    // Color (instance field — BicycleVisuals style, inside class body)
    m = line.match(COLOR_INSTANCE_PATTERN)
    if (m) {
      params.push({
        name: m[2],
        type: 'Color',
        value: m[3].trim(),
        line: lineNum,
        access: 'instance',
      })
      continue
    }
  }

  return params
}

/**
 * Risolve il path assoluto del file C# dato il nome del builder.
 */
function resolveBuilderPath(builderName: string): string | null {
  const fileName = builderName + '.cs'
  const inBuilders = path.join(BUILDERS_DIR, fileName)
  const inCore = path.join(CORE_DIR, fileName)
  if (fs.existsSync(inBuilders)) return inBuilders
  if (fs.existsSync(inCore)) return inCore
  return null
}

/**
 * Ritorna tutte le info di un builder dato il nome.
 */
export function getBuilderInfo(builderName: string): BuilderInfo | null {
  const filePath = resolveBuilderPath(builderName)
  if (!filePath) return null

  const stats = fs.statSync(filePath)
  const params = parseBuilderFile(filePath)
  const category = BUILDER_CATEGORIES[builderName] || 'other'

  // Estrai prima riga significativa dal XML doc comment (<summary>)
  const content = fs.readFileSync(filePath, 'utf-8')
  const summaryMatch = content.match(/\/\/\/\s*([A-Z][^<\n]{5,60})/)
  const description = summaryMatch ? summaryMatch[1].trim() : builderName

  // Path relativo da GAME_PATH per il frontend
  const relativePath = filePath.replace(GAME_PATH, '').replace(/^\//, '')

  return {
    name: builderName,
    filePath: relativePath,
    category,
    params,
    description,
    lastModified: stats.mtime.toISOString(),
  }
}

/**
 * Lista tutti i builder conosciuti con i loro parametri.
 */
export function getAllBuilders(): BuilderInfo[] {
  const names = Object.keys(BUILDER_CATEGORIES)
  const builders: BuilderInfo[] = []
  for (const name of names) {
    const info = getBuilderInfo(name)
    if (info) builders.push(info)
  }
  return builders
}

/**
 * Modifica il valore di un parametro nel file C#.
 * Legge il file, trova la riga esatta, fa la sostituzione, riscrive.
 */
export function updateBuilderParam(
  builderName: string,
  paramName: string,
  newValue: string
): { success: boolean; error?: string } {
  const info = getBuilderInfo(builderName)
  if (!info) return { success: false, error: `Builder ${builderName} not found` }

  const filePath = resolveBuilderPath(builderName)!
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const param = info.params.find(p => p.name === paramName)
  if (!param) return { success: false, error: `Param ${paramName} not found in ${builderName}` }

  const lineIdx = param.line - 1
  const oldLine = lines[lineIdx]

  let newLine: string
  if (param.type === 'Color') {
    // Sostituisci il contenuto dentro new Color(...)
    newLine = oldLine.replace(/new\s+Color\([^)]+\)/, `new Color(${newValue})`)
  } else {
    // Sostituisci il valore dopo il = e prima del ;
    newLine = oldLine.replace(/=\s*[^;]+;/, `= ${newValue};`)
  }

  if (newLine === oldLine) {
    return { success: false, error: 'Replacement produced no change — value may already match' }
  }

  lines[lineIdx] = newLine
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return { success: true }
}
