import {
  filesReady,
  stopFileWriter,
} from '$src/plugin-viteServeFileWriter'
import { jestSetTimeout } from '$test/helpers/timeout'
import fs from 'fs-extra'
import path from 'path'
import { createServer, ViteDevServer } from 'vite'

jestSetTimeout(30000)

const outDir = path.join(__dirname, 'dist-serve')

let devServer: ViteDevServer
beforeAll(async () => {
  await fs.remove(outDir)

  devServer = await createServer({
    configFile: path.join(__dirname, 'vite.config.ts'),
    envFile: false,
    build: { outDir },
  })
})

afterAll(async () => {
  stopFileWriter()
  await devServer.close()
})

test('writes entry points to disk', async () => {
  expect(fs.existsSync(outDir)).toBe(false)

  await Promise.all([devServer.listen(), filesReady()])

  const { port } = devServer.config.server

  expect(fs.existsSync(outDir)).toBe(true)

  const manifest = 'manifest.json'
  const popup = 'pages/popup/index.html'
  const content = 'content/index.js'
  const background = 'background/index.esm-wrapper.js'

  const manifestPath = path.join(outDir, manifest)
  const manifestSource = await fs.readJson(manifestPath)
  expect(manifestSource).toMatchSnapshot(
    {
      content_security_policy: expect.stringMatching(
        /script-src 'self' http:\/\/localhost:\d{4}; object-src 'self'/,
      ),
    },
    manifest,
  )

  const contentPath = path.join(outDir, content)
  const contentSource = await fs.readFile(contentPath, 'utf8')
  expect(contentSource).toMatch('console.log("content script");')

  const popupPath = path.join(outDir, popup)
  const popupSource = await fs.readFile(popupPath, 'utf8')
  expect(popupSource).toMatch(
    `http://localhost:${port}/pages/popup/index.tsx`,
  )

  const backgroundPath = path.join(outDir, background)
  const backgroundSource = await fs.readFile(
    backgroundPath,
    'utf8',
  )
  expect(backgroundSource).toMatch('./index.js')
})
