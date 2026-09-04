import { win32 as pathWin32 } from 'node:path'

// Why %PROMPT%: cmd.exe defines PROMPT=$P$G at startup when unset, so the user's prompt is preserved.
// Why no exit code on D: `prompt` cannot render ERRORLEVEL; consumers treat the code as best-effort.
const CMD_OSC133_PROMPT_COMMAND = 'prompt $E]133;D$E\\$E]133;A$E\\%PROMPT%$E]133;B$E\\'

export function withWindowsCmdOsc133Prompt(
  shellPath: string | undefined,
  startupCommand: string
): string {
  if (!shellPath || pathWin32.basename(shellPath).toLowerCase() !== 'cmd.exe') {
    return startupCommand
  }
  // Why same line: CMD must not render an instrumented prompt until the startup command finishes.
  // Why no space before `&`: `prompt` keeps trailing whitespace as part of the prompt text.
  return `${CMD_OSC133_PROMPT_COMMAND}&${startupCommand}`
}
