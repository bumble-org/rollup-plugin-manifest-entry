import { isAsset, isChunk } from '$src/helpers'
import { getRollupOutput } from '$test/helpers/getRollupOutput'
import { jestSetTimeout } from '$test/helpers/timeout'
import { byFileName } from '$test/helpers/utils'

jestSetTimeout(45000)

test('bundles chunks', async () => {
  const { output } = await getRollupOutput(
    __dirname,
    'rollup.config.js',
  )
  // Chunks
  const chunks = output.filter(isChunk)
  expect(
    chunks.find(byFileName('content/index.js')),
  ).toBeDefined()
  expect(
    chunks.find(byFileName('pages/popup/index.js')),
  ).toBeDefined()

  // 2 entries + 1 chunk
  expect(chunks.length).toBe(3)

  // Assets
  const assets = output.filter(isAsset)

  expect(assets.find(byFileName('manifest.json'))).toBeDefined()
  expect(
    assets.find(byFileName('pages/popup/index.html')),
  ).toBeDefined()

  // manifest, popup, content script wrapper
  expect(assets.length).toBe(3)
})
