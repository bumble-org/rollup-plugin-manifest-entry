import { OutputAsset, rollup, RollupBuild } from 'rollup'
import { ChromeExtensionManifest } from '../src/manifest'
import { byFileName, getExtPath } from '../__fixtures__/utils'

const { default: config } = require(getExtPath('no-scripts/rollup.config.js'))

test('Throws for extension with no scripts at all', async () => {
  try {
    await rollup(config)
  } catch (error) {
    expect(error).toEqual(
      new Error(
        'The manifest must have at least one script or HTML file. If you are not loading files from the manifest, use options.firstClassManifest = false',
      ),
    )
  }
})

test.skip('Handles extension with no scripts at all', async () => {
  let bundle: RollupBuild
  try {
    bundle = await rollup(config)
  } catch (error) {
    error.message = `Could not bundle a manifest with no scripts!\n\nRollup Error: "${error.message}"`
    throw error
  }

  const { output } = await bundle.generate(config.output)
  const manifestAsset = output.find(byFileName('manifest.json')) as OutputAsset
  const manifestSource = manifestAsset.source as string
  const manifest = JSON.parse(manifestSource) as ChromeExtensionManifest

  expect(manifest).toBeDefined()
  expect(manifest.content_scripts).toBeUndefined()
  expect(manifest.web_accessible_resources).toBeUndefined()
  expect(manifest.background).toBeUndefined()
})
