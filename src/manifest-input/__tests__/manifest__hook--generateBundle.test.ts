import { readFileSync } from 'fs-extra'
import {
  OutputBundle,
  RollupOptions,
  EmittedFile,
  EmittedAsset,
} from 'rollup'
import {
  manifestInput,
  ManifestInputPlugin,
  ManifestInputPluginCache,
} from '..'
import { manifestJson } from '../../../__fixtures__/basic-paths'
import { context as minContext } from '../../../__fixtures__/minimal-plugin-context'
import { context } from '../../../__fixtures__/plugin-context'
import { getExtPath } from '../../../__fixtures__/utils'
import { ChromeExtensionManifest } from '../../manifest'

const validate = require('../manifest-parser/validate')
jest.spyOn(validate, 'validateManifest')

const combine = require('../manifest-parser/combine')
jest.spyOn(combine, 'combinePerms')

const options: RollupOptions = {
  input: manifestJson,
}

const bundleJson = readFileSync(
  getExtPath('basic-bundle.json'),
  'utf8',
)

let cache: ManifestInputPluginCache
let plugin: ManifestInputPlugin
beforeEach(async () => {
  cache = {
    assets: [],
    permsHash: '',
    srcDir: null,
    input: [],
    readFile: new Map(),
    assetChanged: false,
    inputAry: [],
    inputObj: {},
  }
  plugin = manifestInput({ cache, verbose: false })

  const opts = plugin.options.call(minContext, options)
  await plugin.buildStart.call(context, opts!)

  jest.clearAllMocks()
})

test('derives permissions from chunks', async () => {
  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  const [manifestFile] = context.emitFile.mock.calls.find(
    ([{ fileName }]) => fileName === 'manifest.json',
  )!

  const manifest: ChromeExtensionManifest = JSON.parse(
    (manifestFile as EmittedAsset).source as string,
  )

  expect(manifest.permissions).toContain('storage')
  expect(manifest.permissions).toContain('contextMenus')
  expect(manifest.permissions).toContain('bookmarks')
  expect(manifest.permissions).toContain('cookies')
  expect(manifest.permissions).toContain('webRequest')
  expect(manifest.permissions).toContain('webRequestBlocking')
  expect(manifest.permissions!.length).toBe(6)
})

test('does not warn permissions for verbose false', async () => {
  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  expect(context.warn).not.toBeCalled()
})

test('Warns permissions for verbose true', async () => {
  const bundle: OutputBundle = JSON.parse(bundleJson)

  const plugin = manifestInput({
    cache: {
      assets: [],
      permsHash: '',
      srcDir: null,
      input: [],
      readFile: new Map(),
      assetChanged: false,
      inputObj: {},
      inputAry: [],
    },
  })
  const opts = plugin.options.call(minContext, options)
  await plugin.buildStart.call(context, opts!)
  await plugin.generateBundle.call(context, opts!, bundle, false)

  expect(context.warn).toBeCalled()
})

test('calls combinePerms', async () => {
  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  expect(combine.combinePerms).toBeCalled()
})

test('includes content script imports in web_accessible_resources', async () => {
  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  const [manifestFile] = context.emitFile.mock.calls.find(
    ([{ fileName }]) => fileName === 'manifest.json',
  )!

  const manifest: ChromeExtensionManifest = JSON.parse(
    (manifestFile as EmittedAsset).source as string,
  )

  expect(manifest.web_accessible_resources!.length).toBe(5)
  expect(manifest.web_accessible_resources).toEqual(
    expect.arrayContaining([
      'options.jpg',
      expect.stringMatching('content'),
      'fonts/*.otf',
      'fonts/*.ttf',
    ]),
  )
})

test('emits dynamic import wrappers once per file', async () => {
  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  expect(context.emitFile).toBeCalledTimes(3)

  expect(context.emitFile).toBeCalledWith<[EmittedFile]>({
    type: 'asset',
    fileName: 'manifest.json',
    source: expect.any(String),
  })
  expect(context.emitFile).toBeCalledWith<[EmittedFile]>({
    type: 'asset',
    name: 'background.js',
    source: expect.any(String),
  })
  expect(context.emitFile).toBeCalledWith<[EmittedFile]>({
    type: 'asset',
    name: 'content.js',
    source: expect.any(String),
  })
})

test('sets public key', async () => {
  const publicKey = 'some-key'

  plugin = manifestInput({ cache, publicKey, verbose: false })

  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  const [manifestFile] = context.emitFile.mock.calls.find(
    ([{ fileName }]) => fileName === 'manifest.json',
  )!

  const manifest: ChromeExtensionManifest = JSON.parse(
    (manifestFile as EmittedAsset).source as string,
  )

  expect(manifest.key).toBe(publicKey)
})

test('validates manifest', async () => {
  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  expect(validate.validateManifest).toBeCalled()
})

test('emits manifest via this.emitFile', async () => {
  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  expect(context.emitFile).toBeCalledWith<[EmittedFile]>({
    type: 'asset',
    fileName: 'manifest.json',
    source: expect.any(String),
  })
})

test('Sets cache.assetChanged to false if cache.permsHash is truthy', async () => {
  cache.assetChanged = true
  cache.permsHash = JSON.stringify('asdk')

  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  expect(cache.assetChanged).toBe(false)
})

test('Warns if new permissions are detected', async () => {
  cache.permsHash = JSON.stringify('asdk')

  plugin = manifestInput({ cache })

  const opts = plugin.options.call(minContext, options)
  await plugin.buildStart.call(context, opts!)

  jest.clearAllMocks()

  const bundle: OutputBundle = JSON.parse(bundleJson)

  await plugin.generateBundle.call(
    context,
    options,
    bundle,
    false,
  )

  expect(context.warn).toBeCalled()
})

test('Throws if cache.manifest is falsey', async () => {
  delete cache.manifest

  const bundle: OutputBundle = JSON.parse(bundleJson)

  const errorMessage = 'cache.manifest is undefined'

  try {
    await plugin.generateBundle.call(
      context,
      options,
      bundle,
      false,
    )
  } catch (error) {
    expect(error).toEqual(new TypeError(errorMessage))
  }
})
