// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import { VaultSessionRow } from './AiVaultSessionRow'

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only window.api shim
  ;(window as any).api = {
    aiVault: {
      listSubagentSessions: vi.fn(),
      getFirstUserPrompt: vi.fn()
    },
    shell: { openFilePath: vi.fn() }
  }
})

const dummySession: AiVaultSession = {
  id: 'session-123',
  sessionId: 'session-123',
  agent: 'codex',
  title: 'Fix AI Vault keep header on expand',
  updatedAt: '2026-07-27T10:00:00.000Z',
  modifiedAt: '2026-07-27T10:00:00.000Z',
  messageCount: 5,
  subagentTranscriptCount: 0,
  executionHostId: 'local',
  filePath: '/path/to/session.json',
  previewMessages: [
    { role: 'user', text: 'Hello AI' },
    { role: 'assistant', text: 'Hello User' }
  ]
}

const testingLibrarySession = {
  id: 'local:gemini:sess-1:/home/a/.gemini/s.json',
  executionHostId: 'local',
  agent: 'gemini',
  sessionId: 'sess-1',
  title: 'A session',
  cwd: null,
  branch: null,
  model: null,
  filePath: '/home/a/.gemini/s.json',
  codexHome: null,
  createdAt: null,
  updatedAt: null,
  modifiedAt: 0,
  messageCount: 2,
  totalTokens: 0,
  previewMessages: [],
  queuedMessageCount: 0,
  subagentTranscriptCount: 0,
  resumeCommand: 'gemini --resume sess-1',
  subagent: null
} as unknown as AiVaultSession

function renderRowStatic(detailsExpanded: boolean): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      <VaultSessionRow
        session={dummySession}
        liveState={null}
        resumeStartup={{ command: 'codex resume' }}
        realHomeResumeStartup={{ command: 'codex resume' }}
        worktreeInfo={null}
        vaultScope="workspace"
        detailsExpanded={detailsExpanded}
        resumeDisabled={false}
        onToggleDetails={vi.fn()}
        showJumpToWorktree={false}
        onResume={vi.fn()}
        resumeLabel="Resume"
        resumeActions={{
          worktree: { worktreeId: null, disabled: true },
          newTab: { worktreeId: null, disabled: true }
        }}
        onResumeInWorktree={vi.fn()}
        onResumeInNewTab={vi.fn()}
        onCopyId={vi.fn()}
        onCopyPath={vi.fn()}
        onRequestDelete={vi.fn()}
      />
    </TooltipProvider>
  )
}

function renderRowTL(handlers: { onToggleDetails: () => void; onRequestDelete?: () => void }) {
  return render(
    <TooltipProvider>
      <VaultSessionRow
        session={testingLibrarySession}
        liveState={null}
        resumeStartup={{ command: 'gemini --resume sess-1' }}
        realHomeResumeStartup={{ command: 'gemini --resume sess-1' }}
        worktreeInfo={null}
        vaultScope="all"
        detailsExpanded={false}
        resumeDisabled={false}
        onToggleDetails={handlers.onToggleDetails}
        showJumpToWorktree={false}
        onResume={vi.fn()}
        resumeLabel="Resume in New Tab"
        resumeActions={{} as never}
        onResumeInWorktree={vi.fn()}
        onResumeInNewTab={vi.fn()}
        onCopyId={vi.fn()}
        onCopyPath={vi.fn()}
        onRequestDelete={handlers.onRequestDelete ?? vi.fn()}
      />
    </TooltipProvider>
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('VaultSessionRow details toggle', () => {
  it('does not expand the row when a menu action is chosen', async () => {
    const onToggleDetails = vi.fn()
    const onRequestDelete = vi.fn()
    renderRowTL({ onToggleDetails, onRequestDelete })
    const user = userEvent.setup()

    await user.click(screen.getByTestId('ai-vault-session-more-actions'))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(onRequestDelete).toHaveBeenCalledTimes(1)
    expect(onToggleDetails).not.toHaveBeenCalled()
  })

  it('still expands when the row itself is clicked', async () => {
    const onToggleDetails = vi.fn()
    const { container } = renderRowTL({ onToggleDetails })
    const user = userEvent.setup()

    const title = container.querySelector('[title="Drag to resume in a new tab"]')
    expect(title).not.toBeNull()
    await user.click(title as Element)

    expect(onToggleDetails).toHaveBeenCalledTimes(1)
  })
})

describe('VaultSessionRow', () => {
  it('renders agent metadata line when collapsed', () => {
    const markup = renderRowStatic(false)

    expect(markup).toContain('Fix AI Vault keep header on expand')
    expect(markup).toContain('Codex')
    expect(markup).toContain('5 msgs')
    expect(markup).toContain('Agent</span><span>: Hello User</span>')
  })

  it('preserves agent metadata line (agent name and icon) when expanded', () => {
    const markup = renderRowStatic(true)

    expect(markup).toContain('Fix AI Vault keep header on expand')
    expect(markup).toContain('Codex')
    expect(markup).toContain('5 msgs')
    expect(markup).toContain('id="ai-vault-session-details-session-123"')
    expect(markup).not.toContain('Agent</span><span>: Hello User</span>')
  })
})
