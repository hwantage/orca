import { test, expect } from './helpers/orca-app'
import { startBrowserLinkServer } from './helpers/browser-link-server'
import { getActiveWorktreeId } from './helpers/store'

test.describe('Image link focus', () => {
  test('focuses the image destination and forwards its close shortcut without closing the opener', async ({
    orcaPage
  }) => {
    const fixture = await startBrowserLinkServer()
    try {
      const worktreeId = (await getActiveWorktreeId(orcaPage))!
      const sourceTabId = await orcaPage.evaluate(
        ({ worktreeId, url }) =>
          window.__store!.getState().createBrowserTab(worktreeId, url, { activate: true }).id,
        { worktreeId, url: fixture.imageSourceUrl }
      )
      const sourceTab = orcaPage.locator(`[data-tab-id="${sourceTabId}"]`)
      const sourceOverlay = orcaPage.locator(`[data-browser-overlay-tab-id="${sourceTabId}"]`)
      const sourceWebview = sourceOverlay.locator('webview')
      await expect(sourceTab).toContainText('Image gallery')
      await expect(sourceWebview).toBeVisible()
      const point = await sourceWebview.evaluate(async (webview: Electron.WebviewTag) => {
        const point: unknown = await webview.executeJavaScript(`(() => {
          const image = document.querySelector('#linked-image')
          const rect = image.getBoundingClientRect()
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        })()`)
        if (
          typeof point !== 'object' ||
          point === null ||
          !('x' in point) ||
          typeof point.x !== 'number' ||
          !('y' in point) ||
          typeof point.y !== 'number'
        ) {
          throw new Error('The linked image has no click coordinates')
        }
        return { x: point.x, y: point.y }
      })
      const bounds = await sourceWebview.boundingBox()
      if (!bounds) {
        throw new Error('The source image webview has no visible bounds')
      }
      await orcaPage.mouse.click(bounds.x + point.x, bounds.y + point.y)

      const destinationTab = orcaPage.locator('[data-tab-id]').filter({ hasText: 'image.png' })
      await expect(destinationTab).toBeVisible()
      const destinationTabId = await destinationTab.getAttribute('data-tab-id')
      const destinationOverlay = orcaPage.locator(
        `[data-browser-overlay-tab-id="${destinationTabId}"]`
      )
      await expect(destinationOverlay).toHaveCSS('opacity', '1')
      const destinationWebview = destinationOverlay.locator('webview')
      await expect
        .poll(() =>
          destinationWebview.evaluate((webview: Electron.WebviewTag) =>
            webview.executeJavaScript(`(() => {
              const image = document.images[0]
              return document.contentType === 'image/png' && image?.complete && image.naturalWidth > 0
            })()`)
          )
        )
        .toBe(true)
      await expect(destinationWebview).toBeFocused()
      // Guest input verifies close forwarding; native OS keyboard routing needs a visible isolated display.
      await orcaPage.evaluate((isMac) => {
        const webview = document.activeElement
        if (
          !webview ||
          !('sendInputEvent' in webview) ||
          typeof webview.sendInputEvent !== 'function'
        ) {
          throw new Error('No browser guest has DOM focus')
        }
        webview.sendInputEvent({
          type: 'keyDown',
          keyCode: 'W',
          modifiers: [isMac ? 'meta' : 'control']
        })
        webview.sendInputEvent({
          type: 'keyUp',
          keyCode: 'W',
          modifiers: [isMac ? 'meta' : 'control']
        })
      }, process.platform === 'darwin')

      await expect(destinationTab).toHaveCount(0)
      await expect(sourceTab).toBeVisible()
      await expect(sourceOverlay).toHaveCSS('opacity', '1')
      await expect
        .poll(() => sourceWebview.evaluate((webview: Electron.WebviewTag) => webview.getURL()))
        .toBe(fixture.imageSourceUrl)
    } finally {
      await fixture.close()
    }
  })
})
