import { isAsset, isChunk } from '$src/helpers'
import { jestSetTimeout } from '$test/helpers/timeout'
import { byFileName } from '$test/helpers/utils'
import path from 'path'
import { RollupOutput } from 'rollup'
import { build } from 'vite'

jestSetTimeout(30000)

test('bundles chunks', async () => {
  const { output } = (await build({
    configFile: path.join(__dirname, 'vite.config.ts'),
    envFile: false,
  })) as RollupOutput

  const manifest = 'manifest.json'
  const background = 'background.js'
  const content = 'content.js'
  const inline = 'inline-script.js'
  const dynamic = 'dynamic-script.js'

  // Chunks
  const chunks = output.filter(isChunk)

  const bgChunk = chunks.find(byFileName(background))!
  expect(bgChunk).toBeDefined()
  expect(bgChunk.code).toMatchSnapshot()

  const csChunk = chunks.find(byFileName(content))!
  expect(csChunk).toBeDefined()
  expect(csChunk.code).toMatchSnapshot()

  expect(chunks.find(byFileName(dynamic))).toBeDefined()
  expect(chunks.find(byFileName(inline))).not.toBeDefined()

  expect(chunks.length).toBe(3)

  // Assets
  const assets = output.filter(isAsset)
  expect(assets.find(byFileName(manifest))).toBeDefined()
  expect(assets.length).toBe(1)
})
