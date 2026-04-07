/**
 * Shared MCP App initialization — used by all MCP UI widgets.
 * connect() calls setupSizeChangedNotifications() automatically (autoResize=true default).
 */
import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps'

export function createApp(name: string): App {
  const app = new App({ name, version: '1.0.0' })
  app.onhostcontextchanged = (ctx) => applyHostContext(ctx)
  app.onerror = (err) => console.error(`[${name}]`, err)
  return app
}

export function applyHostContext(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme)
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables)
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts)

  // Apply container dimensions per spec (§ Container Dimensions)
  const dims = (ctx as any).containerDimensions
  if (dims) {
    const html = document.documentElement
    if ('height' in dims) {
      html.style.height = '100vh'
    } else if ('maxHeight' in dims && dims.maxHeight) {
      html.style.maxHeight = `${dims.maxHeight}px`
    }
    if ('width' in dims) {
      html.style.width = '100vw'
    } else if ('maxWidth' in dims && dims.maxWidth) {
      html.style.maxWidth = `${dims.maxWidth}px`
    }
  }

  if (ctx.safeAreaInsets) {
    const root = document.querySelector('main') || document.body
    root.style.paddingTop = `${ctx.safeAreaInsets.top}px`
    root.style.paddingRight = `${ctx.safeAreaInsets.right}px`
    root.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`
    root.style.paddingLeft = `${ctx.safeAreaInsets.left}px`
  }
}

export async function connectApp(app: App): Promise<void> {
  await app.connect()
  const ctx = app.getHostContext()
  if (ctx) applyHostContext(ctx)
}

/**
 * Workaround for Claude.ai issue #69:
 * Claude.ai ignores ui/notifications/size-changed and reads
 * document.documentElement.style.height directly from the DOM.
 * After rendering content, measure body.scrollHeight and set it
 * explicitly on <html> so the host picks up the correct height.
 *
 * Also sends size-changed notification for spec-compliant hosts.
 * @see https://github.com/anthropics/claude-ai-mcp/issues/69
 */
export function notifyResize(app: App) {
  requestAnimationFrame(() => {
    const h = document.body.scrollHeight
    document.documentElement.style.height = h + 'px'
    app.sendSizeChanged({ width: document.body.scrollWidth, height: h })
  })
}
