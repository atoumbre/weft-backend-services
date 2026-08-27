import { spawn } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

const sourceWorkerdPath = require('workerd').default

const targetDir = join(tmpdir(), 'weft-xrd-usd-price-worker')
const targetWorkerdPath = join(targetDir, 'workerd')
const userArgs = process.argv.slice(2)

mkdirSync(targetDir, { recursive: true })

if (shouldCopyWorkerd(sourceWorkerdPath, targetWorkerdPath)) {
  copyFileSync(sourceWorkerdPath, targetWorkerdPath)
  chmodSync(targetWorkerdPath, 0o755)
}

const args = [
  'dev',
  '--port',
  '8788',
  '--show-interactive-dev-session',
  'false',
  ...userArgs,
]

const child = spawn('wrangler', args, {
  env: {
    ...process.env,
    MINIFLARE_WORKERD_PATH: targetWorkerdPath,
  },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal)
    process.kill(process.pid, signal)

  process.exit(code ?? 0)
})

function shouldCopyWorkerd(sourcePath, targetPath) {
  const sourceStat = statSync(sourcePath)

  try {
    const targetStat = statSync(targetPath)
    return sourceStat.size !== targetStat.size || sourceStat.mtimeMs > targetStat.mtimeMs
  }
  catch {
    return true
  }
}
