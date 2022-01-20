import { isAsset, isChunk } from '$src/helpers'
import { getRollupOutput } from '$test/helpers/getRollupOutput'
import { jestSetTimeout } from '$test/helpers/timeout'
import { byFileName } from '$test/helpers/utils'
import { OutputAsset } from 'rollup'

jestSetTimeout(30000)

test('bundles chunks and assets', async () => {
  const { output } = await getRollupOutput(
    __dirname,
    'rollup.config.js',
  )

  // Chunks
  const chunks = output.filter(isChunk)
  expect(output.find(byFileName('background.js'))).toBeDefined()
  expect(output.find(byFileName('content.js'))).toBeDefined()
  expect(output.find(byFileName('options1.js'))).toBeDefined()
  expect(output.find(byFileName('options2.js'))).toBeDefined()
  expect(output.find(byFileName('options3.js'))).toBeDefined()
  expect(output.find(byFileName('options4.js'))).toBeDefined()
  expect(output.find(byFileName('popup/popup.js'))).toBeDefined()
  expect(
    output.find(byFileName('devtools/devtools1.js')),
  ).toBeDefined()
  expect(
    output.find(byFileName('devtools/devtools2.js')),
  ).toBeDefined()

  const imported = output.find(({ fileName }) =>
    fileName.includes('imported'),
  )
  // Chunk name should not be double hashed
  expect(imported?.fileName).toMatch(
    // eslint-disable-next-line no-useless-escape
    /^modules\/imported-[a-z0-9\-]+?\.js$/,
  )

  // 9 chunks + one shared import (imported.js)
  expect(chunks.length).toBe(10)

  // Assets
  const assets = output.filter(isAsset)

  expect(output.find(byFileName('manifest.json'))).toBeDefined()

  expect(output.find(byFileName('asset.js'))).toBeDefined()

  expect(
    output.find(byFileName('popup/popup.html')),
  ).toBeDefined()
  expect(
    output.find(byFileName('devtools/devtools.html')),
  ).toBeDefined()

  expect(
    output.find(byFileName('images/icon-main-16.png')),
  ).toBeDefined()
  expect(
    output.find(byFileName('images/icon-main-48.png')),
  ).toBeDefined()
  expect(
    output.find(byFileName('images/icon-main-128.png')),
  ).toBeDefined()
  expect(
    output.find(byFileName('images/favicon.ico')),
  ).toBeDefined()
  expect(
    output.find(byFileName('images/favicon.png')),
  ).toBeDefined()

  expect(output.find(byFileName('options.html'))).toBeDefined()
  expect(output.find(byFileName('options.css'))).toBeDefined()
  expect(output.find(byFileName('content.css'))).toBeDefined()
  expect(output.find(byFileName('options.png'))).toBeDefined()
  expect(output.find(byFileName('options.jpg'))).toBeDefined()

  expect(
    output.find(byFileName('_locales/en/messages.json')),
  ).toBeDefined()
  expect(
    output.find(byFileName('_locales/es/messages.json')),
  ).toBeDefined()

  // assets above + content wrapper script
  expect(assets.length).toBe(18)

  const manifestAsset = output.find(
    byFileName('manifest.json'),
  ) as OutputAsset
  const manifestSource = manifestAsset.source as string
  const manifest: chrome.runtime.Manifest =
    JSON.parse(manifestSource)

  expect(manifest).toMatchObject({
    content_security_policy:
      "script-src 'self'; object-src 'self'",
  })
})
