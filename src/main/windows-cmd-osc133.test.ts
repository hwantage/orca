import { describe, expect, it } from 'vitest'
import { withWindowsCmdOsc133Prompt } from './windows-cmd-osc133'

// Why pinned here only: other suites derive expectations from the helper so they stay in lockstep.
const CMD_OSC133_PROMPT_COMMAND = 'prompt $E]133;D$E\\$E]133;A$E\\%PROMPT%$E]133;B$E\\'

describe('withWindowsCmdOsc133Prompt', () => {
  it('installs the CMD lifecycle prompt on the same line as the startup command', () => {
    expect(withWindowsCmdOsc133Prompt('cmd.exe', 'codex --no-alt-screen')).toBe(
      `${CMD_OSC133_PROMPT_COMMAND}&codex --no-alt-screen`
    )
  })

  it('recognizes an absolute CMD path case-insensitively', () => {
    expect(
      withWindowsCmdOsc133Prompt('C:\\Windows\\System32\\CMD.EXE', 'codex --no-alt-screen')
    ).toBe(`${CMD_OSC133_PROMPT_COMMAND}&codex --no-alt-screen`)
  })

  it('leaves non-CMD startup commands unchanged', () => {
    expect(withWindowsCmdOsc133Prompt('powershell.exe', 'codex')).toBe('codex')
    expect(withWindowsCmdOsc133Prompt(undefined, 'codex')).toBe('codex')
  })
})
