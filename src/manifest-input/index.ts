import { cosmiconfigSync } from 'cosmiconfig'
import fs from 'fs-extra'
import memoize from 'mem'
import path, { basename } from 'path'
import { EmittedAsset, OutputChunk, PluginHooks } from 'rollup'
import { isChunk } from '../helpers'
import { combinePerms } from './manifest-parser/combine'
import {
  deriveFiles,
  derivePermissions,
} from './manifest-parser/index'
import { validateManifest } from './manifest-parser/validate'
import { reduceToRecord } from './reduceToRecord'
import { setupLoaderScript } from './setupLoaderScript'
import { wakeEvents } from './wakeEvents'
import { cloneObject } from './cloneObject'
import { ChromeExtensionManifest } from '../manifest'

export function dedupe<T>(x: T[]): T[] {
  return [...new Set(x)]
}

export interface ManifestInputPluginCache {
  assets: string[]
  input: string[]
  permsHash: string
  srcDir: string | null
  /** for memoized fs.readFile */
  readFile: Map<string, any>
  manifest?: ChromeExtensionManifest
  assetChanged: boolean
}

export type ManifestInputPlugin = Pick<
  PluginHooks,
  'options' | 'buildStart' | 'watchChange' | 'generateBundle'
> & {
  name: string
  srcDir: string | null
}

export interface DynamicImportWrapper {
  eventDelay?: number | false
  wakeEvents?: string[]
  noWakeEvents?: boolean
}

export const explorer = cosmiconfigSync('manifest')

const name = 'manifest-input'

const npmPkgDetails =
  process.env.npm_package_name &&
  process.env.npm_package_version &&
  process.env.npm_package_description
    ? {
        name: process.env.npm_package_name,
        version: process.env.npm_package_version,
        description: process.env.npm_package_description,
      }
    : {
        name: '',
        version: '',
        description: '',
      }

/* ============================================ */
/*                MANIFEST-INPUT                */
/* ============================================ */

export function manifestInput(
  {
    dynamicImportWrapper = {
      // Use these wake events by default until dynamic wake events is implemented
      wakeEvents,
    },
    pkg = npmPkgDetails,
    publicKey,
    verbose = true,
    cache = {
      assets: [],
      permsHash: '',
      srcDir: null,
      input: [],
      readFile: new Map(),
      assetChanged: false,
    } as ManifestInputPluginCache,
  } = {} as {
    dynamicImportWrapper?: DynamicImportWrapper
    pkg?: {
      description: string
      name: string
      version: string
    }
    publicKey?: string
    verbose?: boolean
    cache?: ManifestInputPluginCache
  },
): ManifestInputPlugin {
  const readFile = memoize(
    (filepath: string) => fs.readFile(filepath),
    {
      cache: cache.readFile,
    },
  )

  /* ----------- HOOKS CLOSURES START ----------- */

  let manifestPath: string

  const manifestName = 'manifest.json'

  /* ------------ HOOKS CLOSURES END ------------ */

  /* - SETUP DYNAMIC IMPORT LOADER SCRIPT START - */

  const loaderScript = setupLoaderScript(dynamicImportWrapper)

  /* -- SETUP DYNAMIC IMPORT LOADER SCRIPT END -- */

  /* --------------- plugin object -------------- */
  return {
    name,

    get srcDir() {
      return cache.srcDir
    },

    /* ============================================ */
    /*                 OPTIONS HOOK                 */
    /* ============================================ */

    options(options) {
      // Do not reload manifest without changes
      if (!cache.manifest) {
        /* ----------- LOAD AND PROCESS MANIFEST ----------- */

        if (typeof options.input !== 'string') {
          throw new TypeError(
            'RollupOptions.input must be a single Chrome extension manifest.',
          )
        }

        const configResult = explorer.load(options.input) as {
          filepath: string
          config: ChromeExtensionManifest
          isEmpty?: true
        } | null
        if (
          !configResult ||
          typeof configResult.config === 'undefined' ||
          configResult.isEmpty
        ) {
          throw new Error(
            `Could not load ${options.input} as Chrome extension manifest.`,
          )
        }

        manifestPath = configResult.filepath
        cache.manifest = configResult.config

        cache.srcDir = path.dirname(manifestPath)

        // Derive entry paths from manifest
        const { js, html, css, img } = deriveFiles(
          cache.manifest,
          cache.srcDir,
        )

        // Cache derived inputs
        cache.input = [...js, ...html]
        cache.assets = [
          // Dedupe assets
          ...new Set([...css, ...img]),
        ]

        /* --------------- END LOAD MANIFEST --------------- */
      }

      return {
        ...options,
        input: cache.input.reduce(
          reduceToRecord(cache.srcDir),
          {},
        ),
      }
    },

    /* ============================================ */
    /*              HANDLE WATCH FILES              */
    /* ============================================ */

    async buildStart() {
      this.addWatchFile(manifestPath)

      cache.assets.forEach((srcPath) => {
        this.addWatchFile(srcPath)
      })

      const assets: EmittedAsset[] = await Promise.all(
        cache.assets.map(async (srcPath) => {
          const source = await readFile(srcPath)

          return {
            type: 'asset' as 'asset',
            source,
            fileName: srcPath
              // Get relative path
              .replace(cache.srcDir as string, '')
              // Remove initial slash
              .replace(/^\//, ''),
          }
        }),
      )

      assets.forEach((asset) => {
        this.emitFile(asset)
      })
    },

    watchChange(id) {
      if (id.endsWith(manifestName)) {
        // Dump cache.manifest if manifest changes
        delete cache.manifest
        cache.assetChanged = false
      } else {
        // Force new read of changed asset
        cache.assetChanged = cache.readFile.delete(id)
      }
    },

    /* ============================================ */
    /*                GENERATEBUNDLE                */
    /* ============================================ */

    generateBundle(options, bundle) {
      /* ---------- DERIVE PERMISIONS START --------- */

      // Get module ids for all chunks
      let permissions: string[]
      if (cache.assetChanged && cache.permsHash) {
        // Permissions did not change
        permissions = JSON.parse(cache.permsHash)

        cache.assetChanged = false
      } else {
        const chunks = Object.values(bundle).filter(isChunk)

        // Permissions may have changed
        permissions = Array.from(
          chunks.reduce(derivePermissions, new Set<string>()),
        )

        const permsHash = JSON.stringify(permissions)

        if (verbose) {
          if (!cache.permsHash) {
            console.log('Detected permissions:', permissions)
          } else if (permsHash !== cache.permsHash) {
            console.log('Detected new permissions:', permissions)
          }
        }

        cache.permsHash = permsHash
      }

      /* ---------- DERIVE PERMISSIONS END ---------- */

      try {
        // Clone cache.manifest
        if (!cache.manifest)
          throw new TypeError(
            `cache.manifest is ${typeof cache.manifest}`,
          )

        const clonedManifest = cloneObject(cache.manifest)

        const manifestBody = validateManifest({
          manifest_version: 2,
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          ...clonedManifest,
          permissions: combinePerms(
            permissions,
            clonedManifest.permissions || [],
          ),
        })

        const {
          content_scripts: cts = [],
          web_accessible_resources: war = [],
          background: { scripts: bgs = [] } = {},
        } = manifestBody

        /* ------ WEB ACCESSIBLE RESOURCES START ------ */

        const contentScripts = cts.reduce(
          (r, { js = [] }) => [...r, ...js],
          [] as string[],
        )

        if (contentScripts.length) {
          // make all imports & dynamic imports web_acc_res
          // FEATURE: make imports for background not web_acc_res?
          const imports = Object.values(bundle)
            .filter((x): x is OutputChunk => x.type === 'chunk')
            .reduce(
              (r, { isEntry, fileName }) =>
                // Get imported filenames
                !isEntry ? [...r, fileName] : r,
              [] as string[],
            )

          // web_accessible_resources can be used for fingerprinting extensions
          manifestBody.web_accessible_resources = dedupe([
            ...war,
            ...imports,
            ...contentScripts,
          ])
        }

        /* ------- WEB ACCESSIBLE RESOURCES END ------- */

        /* ---- SCRIPT DYNAMIC IMPORT WRAPPER BEGIN --- */

        if (
          dynamicImportWrapper.wakeEvents &&
          dynamicImportWrapper.wakeEvents.length > 0
        ) {
          const emitDynamicImportWrapper = memoize(
            (scriptPath: string) => {
              const _scriptPath = scriptPath.replace(
                /\.ts$/,
                '.js',
              )
              const source = loaderScript(_scriptPath)

              const assetId = this.emitFile({
                type: 'asset',
                source,
                name: basename(_scriptPath),
              })

              return this.getFileName(assetId)
            },
          )

          // Emit background script wrappers
          if (bgs.length) {
            manifestBody.background =
              manifestBody.background || {}

            manifestBody.background.scripts = bgs.map(
              emitDynamicImportWrapper,
            )
          }

          // Emit content script wrappers
          if (cts.length) {
            manifestBody.content_scripts = cts.map(
              ({ js = [], ...rest }) => ({
                js: js.map(emitDynamicImportWrapper),
                ...rest,
              }),
            )
          } else {
            delete manifestBody.content_scripts
          }
        }

        /* ----- SCRIPT DYNAMIC IMPORT WRAPPER END ---- */

        /* --------- STABLE EXTENSION ID BEGIN -------- */

        if (publicKey) {
          manifestBody.key = publicKey
        }

        /* ---------- STABLE EXTENSION ID END --------- */

        /* ----------- OUTPUT MANIFEST.JSON BEGIN ---------- */

        const manifestJson = JSON.stringify(
          manifestBody,
          null,
          2,
        ).replace(/\.[jt]sx?"/g, '.js"')

        // Emit manifest.json
        this.emitFile({
          type: 'asset',
          fileName: manifestName,
          source: manifestJson,
        })
      } catch (error) {
        if (error.name !== 'ValidationError') throw error

        error.errors.forEach((err: { message: string }) => {
          console.log(err)
        })

        this.error(error.message)
      }

      /* ------------ OUTPUT MANIFEST.JSON END ----------- */
    },
  }
}

export default manifestInput
