import path from 'node:path'

// Path-based constants are deprecated — use getGamePaths() from services/game-context instead.
// Kept only as last-resort fallback for callers that don't yet pass a game path explicitly.
export const GAME_PATH = process.env.GAME_PATH || '/Volumes/SSD-FRH-1/Free-River-House/Games/Pizza-Gelato/PizzaGelato-LA-URP'
export const REFERENCE_IMAGE = process.env.REFERENCE_IMAGE || path.join(GAME_PATH, 'references/fly-ride-reference.png')
export const SCREENSHOTS_DIR = path.join(GAME_PATH, 'screenshots')
export const BUILDERS_DIR = path.join(GAME_PATH, 'Assets/Scripts/Builders')
export const CORE_DIR = path.join(GAME_PATH, 'Assets/Scripts/Core')
export const BUILD_SCRIPT = 'build.sh'
export const SCREENSHOT_SCRIPT = 'screenshot.sh'
export const DB_PATH = path.join(process.cwd(), 'db', 'game-wizard.sqlite')

// Timeout in ms
export const BUILD_TIMEOUT = 180_000    // 3 minuti
export const SCREENSHOT_TIMEOUT = 30_000 // 30 secondi
export const GIT_TIMEOUT = 15_000        // 15 secondi

// Builder categories — mapping nome → categoria
export const BUILDER_CATEGORIES: Record<string, string> = {
  BuildingBuilder: 'urban',
  ShopFacadeBuilder: 'urban',
  TrackBuilder: 'environment',
  EnvironmentBuilder: 'environment',
  SkyBuilder: 'environment',
  VesuvioBuilder: 'environment',
  FloraBuilder: 'flora',
  MaritimePineBuilder: 'flora',
  PalmTreeBuilder: 'flora',
  GroundCoverBuilder: 'flora',
  StreetLampBuilder: 'props',
  TrafficLightBuilder: 'props',
  BenchBuilder: 'props',
  GelatoCartBuilder: 'props',
  BoatBuilder: 'props',
  PuddleBuilder: 'props',
  CatBuilder: 'characters',
  PedestrianBuilder: 'characters',
  BicycleVisuals: 'characters',
  LevelDirector: 'environment',
}
