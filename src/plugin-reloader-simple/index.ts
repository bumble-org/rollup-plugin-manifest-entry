import { code as bgClientCode } from 'code ./client/background.ts'
import { code as ctClientCode } from 'code ./client/content.ts'
import { outputJson } from 'fs-extra'
import { join } from 'path'
import { Plugin } from 'rollup'
import { updateManifest } from '../helpers'
import {
  backgroundPageReloader,
  contentScriptReloader,
  timestampPathPlaceholder,
  loadMessagePlaceholder,
  timestampFilename,
} from './CONSTANTS'

export type SimpleReloaderPlugin = Pick<
  Required<Plugin>,
  'name' | 'generateBundle' | 'writeBundle'
>

export interface SimpleReloaderCache {
  bgScriptPath?: string
  ctScriptPath?: string
  timestampPath?: string
  outputDir?: string
  loadMessage?: string
}

// Used for testing
export const _internalCache: SimpleReloaderCache = {}

export const simpleReloader = (
  cache = {} as SimpleReloaderCache,
): SimpleReloaderPlugin | undefined => {
  if (!process.env.ROLLUP_WATCH) {
    return undefined
  }

  return {
    name: 'chrome-extension-simple-reloader',

    generateBundle({ dir }, bundle) {
      cache.outputDir = dir
      cache.loadMessage = [
        'DEVELOPMENT build with simple auto-reloader.',
        `Loaded on ${new Date().toTimeString()}.`,
      ].join('\n')

      /* --------------- EMIT CLIENT FILES --------------- */

      const emit = (
        name: string,
        source: string,
        isFileName?: boolean,
      ) => {
        const id = this.emitFile({
          type: 'asset',
          [isFileName ? 'fileName' : 'name']: name,
          source,
        })

        return this.getFileName(id)
      }

      cache.timestampPath = emit(
        timestampFilename,
        JSON.stringify(Date.now()),
        true,
      )

      cache.bgScriptPath = emit(
        backgroundPageReloader,
        bgClientCode
          .replace(timestampPathPlaceholder, cache.timestampPath)
          .replace(loadMessagePlaceholder, cache.loadMessage),
      )

      cache.ctScriptPath = emit(
        contentScriptReloader,
        ctClientCode.replace(
          loadMessagePlaceholder,
          cache.loadMessage,
        ),
      )

      // Update the exported cache
      Object.assign(_internalCache, cache)

      /* ---------------- UPDATE MANIFEST ---------------- */

      updateManifest(
        (manifest) => {
          /* ------------------ DESCRIPTION ------------------ */

          manifest.description = cache.loadMessage

          /* ---------------- BACKGROUND PAGE ---------------- */

          if (!manifest.background) {
            manifest.background = {}
          }

          manifest.background.persistent = true

          const { scripts: bgScripts = [] } = manifest.background

          if (cache.bgScriptPath) {
            manifest.background.scripts = [
              cache.bgScriptPath,
              ...bgScripts,
            ]
          } else {
            this.error('Unable to emit background page reloader')
          }

          /* ---------------- CONTENT SCRIPTS ---------------- */

          const { content_scripts: ctScripts = [] } = manifest

          if (cache.ctScriptPath) {
            manifest.content_scripts = ctScripts.map(
              ({ js = [], ...rest }) => ({
                js: [cache.ctScriptPath!, ...js],
                ...rest,
              }),
            )
          } else {
            this.error('Unable to emit content script reloader')
          }

          return manifest
        },
        bundle,
        this.error,
      )

      // We'll write this file ourselves, we just need a safe path to write the timestamp
      delete bundle[cache.timestampPath]
    },

    /* -------------- WRITE TIMESTAMP FILE ------------- */
    async writeBundle() {
      try {
        await outputJson(
          join(cache.outputDir!, cache.timestampPath!),
          Date.now(),
        )
      } catch (err) {
        if (typeof err.message === 'string') {
          this.error(
            `Unable to update timestamp file:\n\t${err.message}`,
          )
        } else {
          this.error('Unable to update timestamp file')
        }
      }
    },
  }
}
