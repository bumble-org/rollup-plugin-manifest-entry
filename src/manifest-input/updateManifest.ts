import { RollupOptions } from 'rollup'
import { ManifestInputPluginCache } from '../plugin-options'
import { cloneObject } from './cloneObject'

export function updateManifestV3(
  m: chrome.runtime.ManifestV3,
  options: RollupOptions,
  cache: ManifestInputPluginCache,
) {
  const manifest = cloneObject(m)

  if (manifest.background) {
    manifest.background.type = 'module'
  }

  if (manifest.content_scripts) {
    const { output = {} } = options
    const {
      chunkFileNames = 'chunks/[name]-[hash].js',
    } = Array.isArray(output) ? output[0] : output

    cache.chunkFileNames = chunkFileNames

    // Output could be an array
    if (Array.isArray(output)) {
      if (
        // Should only be one value for chunkFileNames
        output.reduce(
          (r, x) => r.add(x.chunkFileNames ?? 'no cfn'),
          new Set(),
        ).size > 1
      )
        // We need to know chunkFileNames now, before the output stage
        throw new TypeError(
          'Multiple output values for chunkFileNames are not supported',
        )

      // If chunkFileNames is undefined, use our default
      output.forEach((x) => (x.chunkFileNames = chunkFileNames))
    } else {
      // If chunkFileNames is undefined, use our default
      output.chunkFileNames = chunkFileNames
    }

    const allMatches = manifest.content_scripts
      .flatMap(({ matches }) => matches ?? [])
      .concat(manifest.host_permissions ?? [])

    const matches = Array.from(new Set(allMatches))
    const resources = [
      `${chunkFileNames
        .split('/')
        .join('/')
        .replace('[format]', '*')
        .replace('[name]', '*')
        .replace('[hash]', '*')}`,
    ]

    manifest.web_accessible_resources =
      manifest.web_accessible_resources ?? []

    manifest.web_accessible_resources.push({
      resources,
      matches,
    })
  }

  return manifest
}
