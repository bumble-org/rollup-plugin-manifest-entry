import { ModuleNode } from 'vite'

export const CSS_LANGS_RE =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/

export const isCSSRequest = (request: string): boolean =>
  CSS_LANGS_RE.test(request)

/**
 * 深层循环获取 node.importers 中的 css 依赖
 * https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/hmr.ts#L266
 */
const getCSSImportDeps = (
  node: ModuleNode,
  selfAccepting = true,
): Set<ModuleNode> => {
  const addDeps = (importers: Set<ModuleNode>, nodes = new Set<ModuleNode>()) =>
    [...importers].reduce((nodes, node): Set<ModuleNode> => {
      if (nodes.has(node)) return nodes
      if (selfAccepting && !node.isSelfAccepting) return nodes
      if (isCSSRequest(node.url)) {
        return addDeps(node.importers, new Set([...nodes, node]))
      } else {
        return nodes
      }
    }, nodes)

  return addDeps(node.importers)
}

export default getCSSImportDeps