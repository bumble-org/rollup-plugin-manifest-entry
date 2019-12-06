import { Plugin } from 'rollup'
import htmlInputs, {
  HtmlInputsPlugin,
} from './html-inputs/index'
import manifestInput, {
  ManifestInputPlugin,
} from './manifest-input/index'
import {
  validateNames as v,
  ValidateNamesPlugin,
} from './validate-names/index'

export type ChromeExtensionPlugin = Pick<
  Required<Plugin>,
  | 'name'
  | 'options'
  | 'buildStart'
  | 'watchChange'
  | 'generateBundle'
> & {
  // For testing
  _plugins: {
    manifest: ManifestInputPlugin
    html: HtmlInputsPlugin
    validate: ValidateNamesPlugin
  }
}

export { pushReloader } from './push-reloader'
export { simpleReloader } from './simple-reloader'

export interface ChromeExtensionOptions {
  dynamicImportWrapper?: {
    // TODO: Add dynamic or static event detection
    wakeEvents?: string[]
    eventDelay?: number | false
  }
  verbose?: boolean
  pkg?: {
    description: string
    name: string
    version: string
  }
  publicKey?: string
}

export const chromeExtension = (
  options = {} as ChromeExtensionOptions,
): ChromeExtensionPlugin => {
  const manifest = manifestInput(options)
  const html = htmlInputs(manifest)
  const validate = v()

  return {
    name: 'chrome-extension',

    // For testing
    _plugins: { manifest, html, validate },

    options(options) {
      try {
        return [manifest, html].reduce((opts, plugin) => {
          const result = plugin.options.call(this, opts)

          return result || options
        }, options)
      } catch (error) {
        const manifestError =
          'The manifest must have at least one script or HTML file.'
        const htmlError =
          'At least one HTML file must have at least one script.'

        if (
          error.message === manifestError ||
          error.message === htmlError
        ) {
          throw new Error(
            'A Chrome extension must have at least one script or HTML file.',
          )
        } else {
          throw error
        }
      }
    },

    async buildStart(options) {
      await Promise.all([
        manifest.buildStart.call(this, options),
        html.buildStart.call(this, options),
      ])
    },

    watchChange(id) {
      manifest.watchChange.call(this, id)
      html.watchChange.call(this, id)
    },

    async generateBundle(...args) {
      await manifest.generateBundle.call(this, ...args)
      await validate.generateBundle.call(this, ...args)
    },
  }
}
