import type { ElectronApplication, Locator } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { startClientHostedMarkerFixture } from './helpers/client-hosted-browser-fixture'
import {
  ensureTerminalVisible,
  getActiveWorktreeId,
  waitForActiveWorktree,
  waitForSessionReady
} from './helpers/store'

async function expectBrowserGuestFocused(
  electronApp: ElectronApplication,
  webview: Locator
): Promise<number> {
  let guestId = 0
  await expect(async () => {
    guestId = await webview.evaluate((element: Electron.WebviewTag) => element.getWebContentsId())
    expect(
      await electronApp.evaluate(({ BrowserWindow, webContents }) => ({
        windowFocused: BrowserWindow.getFocusedWindow() !== null,
        guestId: webContents.getFocusedWebContents()?.id ?? null
      }))
    ).toEqual({ windowFocused: true, guestId })
  }).toPass({ timeout: 10_000 })
  return guestId
}

test.describe('Browser link native focus @headful', () => {
  test.describe.configure({ mode: 'default' })
  // Native keyboard focus requires the isolated test app to become active.
  test.use({ orcaAppExtraEnv: { ORCA_E2E_FOREGROUND: '1' } })

  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
    await ensureTerminalVisible(orcaPage)
  })

  for (const route of ['target=_blank', 'context menu'] as const) {
    test(`CmdOrCtrl+W closes only the ${route} destination`, async ({ electronApp, orcaPage }) => {
      const fixture = await startClientHostedMarkerFixture({
        created: 'Source page',
        moved: 'Linked destination'
      })
      try {
        const worktreeId = (await getActiveWorktreeId(orcaPage))!
        const sourceTabId = await orcaPage.evaluate(
          ({ worktreeId, url }) =>
            window.__store!.getState().createBrowserTab(worktreeId, url, {
              title: 'Source page',
              activate: true
            }).id,
          { worktreeId, url: fixture.markerUrl }
        )
        const sourceTab = orcaPage.locator(`[data-tab-id="${sourceTabId}"]`)
        const sourceOverlay = orcaPage.locator(`[data-browser-overlay-tab-id="${sourceTabId}"]`)
        const sourceWebview = sourceOverlay.locator('webview')
        await expect(sourceWebview).toBeVisible()
        await expect(async () => {
          expect(
            await sourceWebview.evaluate((webview: Electron.WebviewTag) =>
              webview.executeJavaScript('document.querySelector("#marker")?.textContent')
            )
          ).toBe('Source page')
        }).toPass({ timeout: 10_000 })

        const point = await sourceWebview.evaluate(async (webview: Electron.WebviewTag, url) => {
          return (await webview.executeJavaScript(`(() => {
            const link = document.createElement('a')
            link.href = ${JSON.stringify(url)}
            link.target = '_blank'
            link.textContent = 'Open destination'
            document.body.append(link)
            const rect = link.getBoundingClientRect()
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          })()`)) as { x: number; y: number }
        }, fixture.movedUrl)
        await sourceWebview.evaluate((webview: Electron.WebviewTag) => {
          window.focus()
          webview.focus()
        })
        await expectBrowserGuestFocused(electronApp, sourceWebview)

        await sourceWebview.evaluate(
          async (webview: Electron.WebviewTag, { point, button }) => {
            await webview.sendInputEvent({ type: 'mouseMove', ...point })
            await webview.sendInputEvent({ type: 'mouseDown', button, clickCount: 1, ...point })
            await webview.sendInputEvent({ type: 'mouseUp', button, clickCount: 1, ...point })
          },
          { point, button: route === 'context menu' ? ('right' as const) : ('left' as const) }
        )
        if (route === 'context menu') {
          // The first link action opens an Orca tab in every app language.
          await orcaPage.getByTestId('browser-context-menu').getByRole('menuitem').first().click()
          await expect(orcaPage.getByTestId('browser-context-menu')).toHaveCount(0)
        }

        const destinationTab = orcaPage
          .locator('[data-tab-id]')
          .filter({ hasText: 'Linked destination' })
        await expect(destinationTab).toBeVisible()
        const destinationTabId = await destinationTab.getAttribute('data-tab-id')
        const destinationOverlay = orcaPage.locator(
          `[data-browser-overlay-tab-id="${destinationTabId}"]`
        )
        await expect(destinationOverlay).toHaveCSS('opacity', '1')
        const guestId = await expectBrowserGuestFocused(
          electronApp,
          destinationOverlay.locator('webview')
        )
        await electronApp.evaluate(({ webContents }, expectedGuestId) => {
          const focused = webContents.getFocusedWebContents()
          if (focused?.id !== expectedGuestId) {
            throw new Error('Keyboard focus left the destination guest before CmdOrCtrl+W')
          }
          focused.sendInputEvent({
            type: 'keyDown',
            keyCode: 'W',
            modifiers: process.platform === 'darwin' ? ['meta'] : ['control']
          })
        }, guestId)

        await expect(destinationTab).toHaveCount(0)
        await expect(sourceTab).toBeVisible()
        await expect(sourceOverlay).toHaveCSS('opacity', '1')
        await expect
          .poll(() => sourceWebview.evaluate((webview: Electron.WebviewTag) => webview.getURL()))
          .toBe(fixture.markerUrl)
      } finally {
        await fixture.close()
      }
    })
  }
})
