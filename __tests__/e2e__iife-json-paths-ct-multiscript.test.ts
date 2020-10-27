import { byFileName, requireExtFile } from '../__fixtures__/utils'
import { rollup, RollupOutput, OutputAsset } from 'rollup'
import { ChromeExtensionManifest } from '../src/manifest'
import { OutputChunk } from 'rollup'
import { RollupOptions } from 'rollup'

const config = requireExtFile<RollupOptions>(__filename, 'rollup.config.js')

let outputPromise: Promise<RollupOutput>
beforeAll(async () => {
  outputPromise = rollup(config).then((bundle) => bundle.generate(config.output as any))
  return outputPromise
}, 10000)

test('bundles multiple content scripts as iife', async () => {
  const { output } = await outputPromise

  const content1Js = output.find(byFileName('content1.js')) as OutputAsset
  const content2Js = output.find(byFileName('content2.js')) as OutputAsset
  const manifestJson = output.find(byFileName('manifest.json')) as OutputAsset

  expect(content1Js).toBeDefined()
  expect(content1Js).toMatchObject({
    source: expect.any(String),
    fileName: 'content1.js',
    type: 'asset',
  })

  expect(content2Js).toBeDefined()
  expect(content2Js).toMatchObject({
    source: expect.any(String),
    fileName: 'content2.js',
    type: 'asset',
  })

  expect(manifestJson).toBeDefined()
  expect(manifestJson).toMatchObject({
    source: expect.any(String),
    fileName: 'manifest.json',
    type: 'asset',
  })

  const manifest = JSON.parse(manifestJson.source as string) as ChromeExtensionManifest

  expect(manifest.background).toBeUndefined()
  expect(manifest.content_scripts?.[0]).toMatchObject({
    js: ['content1.js', 'content2.js'],
  })
  expect(manifest.web_accessible_resources).toBeUndefined()

  // TODO: test that contentJs.code is an iife
})
