import { HMRPayload } from 'vite'
import { manifestFiles, _debug } from '../helpers'
import { crxHmrPayload$, hmrPayload$ } from './hmrPayload'
import { isImporter } from '../isImporter'
import { isAbsolute, join } from '../path'
import type { CrxHMRPayload, CrxPluginFn, ManifestFiles } from '../types'

const debug = _debug('hmr')

export const crxRuntimeReload: CrxHMRPayload = {
  type: 'custom',
  event: 'crx:runtime-reload',
}

export const pluginHMR: CrxPluginFn = () => {
  let finalManifestFiles: ManifestFiles
  let decoratedSend: ((payload: HMRPayload) => void) | undefined

  return [
    {
      name: 'crx:hmr',
      apply: 'serve',
      enforce: 'pre',
      // server hmr host should be localhost
      config({ server = {}, ...config }) {
        if (server.hmr === false) return
        if (server.hmr === true) server.hmr = {}
        server.hmr = server.hmr ?? {}
        server.hmr.host = 'localhost'

        return { server, ...config }
      },
      // server should ignore outdir
      configResolved(config) {
        const { watch = {} } = config.server
        config.server.watch = watch
        watch.ignored = watch.ignored
          ? [...new Set([watch.ignored].flat())]
          : []
        const outDir = isAbsolute(config.build.outDir)
          ? config.build.outDir
          : join(config.root, config.build.outDir, '**/*')
        if (!watch.ignored.includes(outDir)) watch.ignored.push(outDir)
      },
      // emit hmr payloads for file writer
      configureServer(server) {
        if (server.ws.send !== decoratedSend) {
          // decorate server websocket send method
          const { send } = server.ws
          decoratedSend = (payload: HMRPayload) => {
            hmrPayload$.next(payload) // sniff hmr events
            send(payload) // don't interfere with normal hmr
          }
          server.ws.send = decoratedSend
          crxHmrPayload$.subscribe((payload) => {
            send(payload) // send crx hmr events
          })
        }
      },
      // background changes require a full extension reload
      handleHotUpdate({ file, modules, server }) {
        const background =
          finalManifestFiles.background[0] &&
          join(server.config.root, finalManifestFiles.background[0])

        // check that the changed file is not a background dependency
        if (background)
          if (file === background || modules.some(isImporter(background))) {
            debug('sending runtime reload')
            server.ws.send(crxRuntimeReload)
            return []
          }
      },
    },
    {
      name: 'crx:hmr',
      apply: 'build',
      enforce: 'post',
      // get final output manifest for handleHotUpdate 👆
      async renderCrxManifest(manifest) {
        finalManifestFiles = await manifestFiles(manifest)
        return null
      },
    },
  ]
}
