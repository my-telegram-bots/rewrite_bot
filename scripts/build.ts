import { execFileSync } from 'child_process'
import { rmSync } from 'fs'
import { resolve } from 'path'
import { copyAssets } from './copy-assets'

rmSync(resolve('dist'), { recursive: true, force: true })
execFileSync(process.execPath, [resolve('node_modules', 'typescript', 'bin', 'tsc')], { stdio: 'inherit' })
copyAssets()
