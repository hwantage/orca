// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWebviewGuestFocus } from './browser-page-guest-focus'

describe('useWebviewGuestFocus', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('focuses the window before the webview', () => {
    const focusWindow = vi.spyOn(window, 'focus').mockImplementation(() => {})
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: this test uses only DOM focus and identity, not Electron APIs.
    const webview = document.createElement('webview') as Electron.WebviewTag
    webview.tabIndex = -1
    document.body.appendChild(webview)
    const focusWebview = vi.spyOn(webview, 'focus')

    const { result } = renderHook(() => useWebviewGuestFocus({ current: webview }))

    expect(result.current.focus()).toBe(true)
    expect(document.activeElement).toBe(webview)
    expect(focusWindow.mock.invocationCallOrder[0]).toBeLessThan(
      focusWebview.mock.invocationCallOrder[0]
    )
    webview.remove()
  })
})
