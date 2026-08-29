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
  expect(existsSync(resolve(__dirname, '..', 'src', 'db', 'migrations', '002_short_links_default_on.sql'))).toBe(true)
})

test('systemd deployment loads env and gates compiled startup on migration and checks', () => {
  const service = readFileSync(resolve(__dirname, '..', 'deploy', 'rewrite-bot.service'), 'utf8')
  expect(service).toContain('EnvironmentFile=/data/bot/rewrite_bot/.env')
  expect(service).toContain('DynamicUser=true')
  expect(service).toContain('User=rewrite-bot')
  expect(service).toContain('StateDirectory=rewrite-bot')
  expect(service).toContain('test -e /data/bot/rewrite_bot/prisma/dev.db')
  expect(service).toContain('ExecStartPre=/bin/sh -ec')
  expect(service).not.toContain('ExecStartPre=+/bin/sh')
  expect(service).not.toContain('-o rewrite-bot')
  expect(service).toContain('DATABASE_PATH=/var/lib/rewrite-bot/rewrite_bot.db node dist/src/db/cli-migrate.js')
  expect(service).toContain('DATABASE_PATH=/var/lib/rewrite-bot/rewrite_bot.db node dist/src/db/cli-check.js')
  expect(service).toContain('DATABASE_PATH=/var/lib/rewrite-bot/rewrite_bot.db node dist/src/app.js')
  expect(service).not.toContain('dist/app.js')
})
