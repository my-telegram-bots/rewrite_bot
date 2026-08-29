import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

test('release start command and copied migration match the compiled source layout', () => {
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }
  expect(packageJson.scripts.start).toBe('node dist/src/app.js')
  expect(packageJson.scripts.build).toBe('ts-node ./scripts/build.ts')

  const copyScript = readFileSync(resolve(__dirname, '..', 'scripts', 'copy-assets.ts'), 'utf8')
  expect(copyScript).toContain("resolve('dist/src/db/migrations')")
  expect(copyScript).toContain("resolve('dist/src/app.js')")
  expect(existsSync(resolve(__dirname, '..', 'src', 'db', 'migrations', '001_canonical_schema.sql'))).toBe(true)
})
