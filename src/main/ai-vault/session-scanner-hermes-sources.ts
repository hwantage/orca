import { access, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { AiVaultScanIssue } from '../../shared/ai-vault-types'
import { discoverFiles } from './session-scanner-discovery'
import {
  listHermesSqliteSessionIds,
  listHermesSqliteSessions
} from './session-scanner-hermes-sqlite'
import type {
  AiVaultScanOptions,
  FileWithMtime,
  SessionFileDiscovery
} from './session-scanner-types'
import { sessionRootDirs } from './session-scanner-values'

/**
 * Candidate Hermes root directories in priority order. Hermes honors
 * `HERMES_HOME`; on Windows the installer defaults to `%LOCALAPPDATA%\hermes`
 * when `~/.hermes` is absent. The first existing candidate wins at scan time.
 *
 * Mirrors Hermes' own `get_default_hermes_root`: when `HERMES_HOME` is
 * `<root>/profiles/<name>` the root is `<root>`, so every sibling profile is
 * aggregated no matter which profile launched Orca.
 */
export function hermesHomeCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const fromEnv = env.HERMES_HOME?.trim()
  if (fromEnv) {
    return [hermesRootOfHome(fromEnv)]
  }
  const candidates = [join(homedir(), '.hermes')]
  const localAppData = env.LOCALAPPDATA?.trim()
  if (localAppData) {
    candidates.push(join(localAppData, 'hermes'))
  }
  return candidates
}

/**
 * `<root>/profiles/<name>` → `<root>`; any other path is already a root.
 */
export function hermesRootOfHome(home: string): string {
  const parent = dirname(home)
  return basename(parent).toLowerCase() === 'profiles' ? dirname(parent) : home
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Order-preserving dedupe; Windows paths compare case-insensitively.
 */
function dedupePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    const key = process.platform === 'win32' ? path.toLowerCase() : path
    if (!seen.has(key)) {
      seen.add(key)
      out.push(path)
    }
  }
  return out
}

/**
 * Resolve every existing Hermes root from `hermesHomeCandidates`. With no
 * `HERMES_HOME`, both `~/.hermes` and `%LOCALAPPDATA%\hermes` may hold data
 * (for example after an installer migration), so all existing roots are
 * scanned. Falls back to the first candidate when none exists.
 */
export async function resolveHermesRoots(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const candidates = hermesHomeCandidates(env)
  const existing: string[] = []
  for (const candidate of candidates) {
    if (await directoryExists(candidate)) {
      existing.push(candidate)
    }
  }
  return existing.length > 0 ? existing : [candidates[0]!]
}

/**
 * Resolve the primary Hermes root (first existing candidate).
 */
export async function resolveHermesHome(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  return (await resolveHermesRoots(env))[0]!
}

/**
 * Enumerate every Hermes home that can hold a state.db: the root home plus each
 * named profile under `<home>/profiles/<name>/`. Profiles are full Hermes homes
 * with their own state.db, sessions/ and config.yaml.
 */
export async function hermesHomeDirs(hermesHome: string): Promise<string[]> {
  const dirs = [hermesHome]
  try {
    const entries = await readdir(join(hermesHome, 'profiles'), { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(join(hermesHome, 'profiles', entry.name))
      }
    }
  } catch {
    // Why: no profiles directory means only the root home is in use.
  }
  return dirs
}

/**
 * Discover Hermes sessions from both legacy JSON files (`session_*.json`) and
 * the SQLite database (`state.db`), deduplicating at the file level.
 * Legacy JSON files whose session ID matches a SQLite entry are dropped in favor
 * of the SQLite database as the source of truth on 0.19+.
 * @param options - AI Vault scan options.
 * @param wslHomeDirs - Normalized WSL home directory paths.
 * @param limit - Maximum number of sessions per source.
 * @param issues - Collected scan issues.
 * @returns Array of promises resolving to `SessionFileDiscovery`.
 */
export function hermesDiscoveries(
  options: AiVaultScanOptions,
  wslHomeDirs: readonly string[],
  limit: number,
  issues: AiVaultScanIssue[]
): Promise<SessionFileDiscovery>[] {
  return [discoverHermesSessions(options, wslHomeDirs, limit, issues)]
}

async function discoverHermesSessions(
  options: AiVaultScanOptions,
  wslHomeDirs: readonly string[],
  limit: number,
  issues: AiVaultScanIssue[]
): Promise<SessionFileDiscovery> {
  // Why: a caller-supplied sessions dir (tests, overrides) pins a single root and
  // is kept verbatim; otherwise every existing Hermes root on the host is scanned.
  const hostRoots = options.hermesSessionsDir
    ? [dirname(options.hermesSessionsDir)]
    : await resolveHermesRoots()
  const hostSessionsDir = options.hermesSessionsDir ?? join(hostRoots[0]!, 'sessions')
  const homeDirs = dedupePaths(
    (await Promise.all(hostRoots.map((root) => hermesHomeDirs(root)))).flat()
  )
  const rootDirs = dedupePaths([
    ...sessionRootDirs(hostSessionsDir, wslHomeDirs, ['.hermes', 'sessions']),
    ...homeDirs.map((dir) => join(dir, 'sessions'))
  ])

  const fileDiscoveryPromises = rootDirs.map((rootDir) =>
    discoverFiles({
      rootDir,
      limit,
      agent: 'hermes',
      issues,
      extensions: ['.json'],
      filePredicate: (path) => basename(path).startsWith('session_')
    })
  )

  const dbPaths = options.hermesStateDbPaths
    ? [...options.hermesStateDbPaths]
    : dedupePaths([
        ...homeDirs.map((dir) => join(dir, 'state.db')),
        ...wslHomeDirs.map((homeDir) => join(homeDir, '.hermes', 'state.db'))
      ])
  const sqlitePromise = listHermesSqliteSessions({ dbPaths, limit, issues })
  const sqliteSessionIds = listHermesSqliteSessionIds(dbPaths)

  const [fileResults, sqliteCandidates] = await Promise.all([
    Promise.all(fileDiscoveryPromises),
    sqlitePromise
  ])
  const sqliteFiles = sqliteCandidates.map((c) => c.file)

  // Why: collect all legacy JSON session files across all root dirs (local & WSL)
  // and filter out any that are duplicated in the SQLite database.
  const allFiles: FileWithMtime[] = []
  for (const res of fileResults) {
    for (const file of res.files) {
      const name = basename(file.path, '.json')
      const sessionId = name.startsWith('session_') ? name.slice(8) : name
      if (!sqliteSessionIds.has(sessionId)) {
        allFiles.push(file)
      }
    }
  }
  allFiles.push(...sqliteFiles)

  return {
    agent: 'hermes' as const,
    rootDir: fileResults[0]?.rootDir ?? hostSessionsDir,
    files: allFiles
  }
}
