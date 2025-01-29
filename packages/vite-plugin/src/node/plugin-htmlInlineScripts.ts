import { load } from 'cheerio'
import loader from 'client/es/page-inline-script-loader.ts'
import jsesc from 'jsesc'
import {
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  IndexHtmlTransformHook,
} from 'vite'
import { isString, _debug } from './helpers'
import { dirname, join, parse, resolve } from './path'
import { CrxPlugin, CrxPluginFn } from './types'

const pluginName = 'crx:html-inline-scripts'
const debug = _debug(pluginName)

const prefix = '@crx/inline-script'

const isInlineTag = (t: HtmlTagDescriptor): boolean =>
  t.tag === 'script' && !t.attrs?.src

/** Adds prefix and removes file extension so Vite doesn't resolve it as an html file */
const toKey = (ctx: IndexHtmlTransformContext) => {
  const { dir, name } = parse(ctx.path)
  return join(prefix, dir, name)
}

/**
 * Plugins like `@vitejs/plugin-react` add an inline script during development
 * to ensure it runs before module scripts.
 *
 * The Chrome Extension CSP forbids inline scripts. There is no way to relax
 * this constraint in Manifest V3. We need a way to orchestrate the order of
 * script execution in extension pages.
 *
 * This plugin audits the other plugins to see if they add inline scripts and
 * when needed it coordinates page script execution.
 */
export const pluginHtmlInlineScripts: CrxPluginFn = () => {
  /** Page tags by filename converted to Base64 */
  const pages = new Map<
    string,
    IndexHtmlTransformContext & { scripts: HtmlTagDescriptor[] }
  >()
  /** Wrap transformIndexHtml hooks in auditor function to check for inline scripts */
  const auditTransformIndexHtml = (p: CrxPlugin): void => {
    let transform: IndexHtmlTransformHook
    if (typeof p.transformIndexHtml === 'function') {
      transform = p.transformIndexHtml
      p.transformIndexHtml = auditor
    } else if (typeof p.transformIndexHtml === 'object') {
      transform = p.transformIndexHtml.transform
      p.transformIndexHtml.transform = auditor
    }

    async function auditor(_html: string, ctx: IndexHtmlTransformContext) {
      const result = await transform(_html, ctx)
      if (!result || typeof result === 'string') return result

      let html: string | undefined
      let tags: Set<HtmlTagDescriptor>
      if (Array.isArray(result)) {
        tags = new Set(result)
      } else {
        tags = new Set(result.tags)
        html = result.html
      }

      const scripts: HtmlTagDescriptor[] = []
      for (const t of tags)
        if (t.tag === 'script') {
          tags.delete(t) // don't emit script tags now
          scripts.push(t) // save this to emit later
        }

      const key = toKey(ctx)
      const page = pages.get(key)!
      page?.scripts.push(...scripts)
      pages.set(key, page)

      return html ? { html, tags: [...tags] } : [...tags]
    }
  }

  let base: string
  /** Reset the page tag cache at transform start */
  const prePlugin: CrxPlugin = {
    name: 'crx:html-auditor-pre',
    transformIndexHtml(html, ctx) {
      const key = toKey(ctx)
      pages.set(key, {
        ...ctx,
        scripts: [
          {
            tag: 'script',
            attrs: {
              type: 'module',
              src: join(base, '@vite/client'),
            },
            injectTo: 'head-prepend',
          },
        ],
      })
    },
  }

  /** Preps html if another plugin added an inline script */
  const postPlugin: CrxPlugin = {
    name: 'crx:html-auditor-post',
    // this hook isn't audited b/c we add it after we set up the auditors
    transformIndexHtml(html, ctx) {
      const key = toKey(ctx)
      const p = pages.get(key)
      if (p?.scripts.some(isInlineTag)) {
        const $ = load(html)

        // add existing scripts to run in the loader
        p.scripts.push(
          ...$('script')
            .toArray()
            .map((el) => ({
              tag: 'script',
              attrs: { src: $(el).attr('src'), type: 'module' },
            })),
        )

        // we only want our loader script to run
        $('script').remove()

        // this will load all the other scripts
        const loader = {
          tag: 'script',
          attrs: { src: `${key}?t=${Date.now()}`, type: 'module' },
        }

        return { html: $.html()!, tags: [loader] }
      }

      return p?.scripts ?? undefined
    },
  }

  return {
    name: 'crx:html-auditor',
    apply: 'serve',
    configResolved(config) {
      base = config.base // used by crx:html-auditor-pre
      const plugins = config.plugins as CrxPlugin[]
      for (const p of plugins) auditTransformIndexHtml(p)
      plugins.unshift(prePlugin)
      plugins.push(postPlugin)
    },
    configureServer(server) {
      const { transformIndexHtml } = server
      /**
       * Vite adds the client tag outside the plugin hook cycle, so we can't
       * audit it. If we find the inline script prefix in a response, we remove
       * the vite client tag and always add it in the loader script.
       */
      server.transformIndexHtml = async function auditor(
        url,
        html,
        originalUrl,
      ) {
        let result = await transformIndexHtml(url, html, originalUrl)

        if (result.includes(prefix))
          result = result.replace(/\s+<script.+?@vite\/client.+?script>/, '')

        return result
      }
    },
    resolveId(source) {
      const i = source.indexOf(prefix)
      if (i > -1) return source.slice(i)
    },
    load(id) {
      if (id.startsWith(prefix)) {
        const page = pages.get(id)
        if (page) {
          const inline = page.scripts
            .filter(isInlineTag)
            .map((t) => t.children)
            .join('\n')

          const dir = dirname(page.path)
          const scripts = page.scripts
            .map(({ attrs }) => attrs?.src)
            .filter(isString)
            .filter((src) => src !== '/@vite/client')
            .map((src) => (src.startsWith('.') ? resolve(dir, src) : src))
          const json = `"${jsesc(JSON.stringify(scripts), {
            quotes: 'double',
          })}"`

          return [inline, loader.replace('SCRIPTS', json)].join('\n')
        } else {
          debug('page missing %s', id)
        }
      }
    },
  }
}
