import { rollup } from 'rollup'
import { isAsset, isChunk } from '../src/helpers'
import { byFileName, getExtPath } from '../__fixtures__/utils'
import { writeJSON } from 'fs-extra'

const { default: config } = require(getExtPath(
  'basic/rollup.config.js',
))

test('bundles chunks and assets', async () => {
  const bundle = await rollup(config)

  if (!process.env.JEST_WATCH) {
    writeJSON(getExtPath('basic-build.json'), bundle, {
      spaces: 2,
    })
  }

  const { output } = await bundle.generate(config.output)

  // Chunks
  const chunks = output.filter(isChunk)
  expect(chunks.length).toBe(7)
  expect(output.find(byFileName('background.js'))).toBeDefined()
  expect(output.find(byFileName('content.js'))).toBeDefined()
  expect(output.find(byFileName('options1.js'))).toBeDefined()
  expect(output.find(byFileName('options2.js'))).toBeDefined()
  expect(output.find(byFileName('options3.js'))).toBeDefined()
  expect(output.find(byFileName('options4.js'))).toBeDefined()
  expect(output.find(byFileName('popup/popup.js'))).toBeDefined()

  // Assets
  const assets = output.filter(isAsset)
  expect(assets.length).toBe(16)
  expect(output.find(byFileName('asset.js'))).toBeDefined()
  expect(
    output.find(byFileName('popup/popup.html')),
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
  expect(output.find(byFileName('options.html'))).toBeDefined()
  expect(output.find(byFileName('options.css'))).toBeDefined()
  expect(output.find(byFileName('content.css'))).toBeDefined()
  expect(output.find(byFileName('options.png'))).toBeDefined()
  expect(output.find(byFileName('options.jpg'))).toBeDefined()
  expect(output.find(byFileName('manifest.json'))).toBeDefined()

  expect(
    output.find(byFileName('fonts/NotoSans-Light.ttf')),
  ).toBeDefined()
  expect(
    output.find(byFileName('fonts/NotoSans-Black.ttf')),
  ).toBeDefined()
  expect(
    output.find(byFileName('fonts/Missaali-Regular.otf')),
  ).toBeDefined()

  // plus 2 wrappers background and content
}, 5 * 60 * 1000)

test.todo('Includes imports in web_accessible_resources')
