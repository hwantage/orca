// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFileExplorerAutoReveal } from './useFileExplorerAutoReveal'
import type { OpenFile } from '@/store/slices/editor'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { FileExplorerRowProjection } from './file-explorer-row-projection'

vi.mock('@/store', () => ({
  useAppStore: {
    setState: vi.fn()
  }
}))

function mockProjection(hasPathResult = false, indexResult = 0): FileExplorerRowProjection {
  return {
    hasPath: vi.fn().mockReturnValue(hasPathResult),
    getIndexByPath: vi.fn().mockReturnValue(indexResult)
  } as unknown as FileExplorerRowProjection
}

describe('useFileExplorerAutoReveal', () => {
  const defaultParams = {
    activeWorktreeId: 'wt-1',
    worktreePath: '/repo/wt',
    pendingExplorerReveal: null,
    setSelectedPath: vi.fn(),
    virtualizer: { scrollToIndex: vi.fn() } as unknown as Virtualizer<HTMLDivElement, Element>
  }

  it('triggers auto-reveal for edit mode tabs', () => {
    const setSelectedPath = vi.fn()
    const openFiles: OpenFile[] = [
      {
        id: 'file-1',
        filePath: '/repo/wt/src/index.ts',
        relativePath: 'src/index.ts',
        worktreeId: 'wt-1',
        language: 'typescript',
        isDirty: false,
        mode: 'edit'
      }
    ]
    const projection = mockProjection(true, 5)

    renderHook(() =>
      useFileExplorerAutoReveal({
        ...defaultParams,
        activeFileId: 'file-1',
        openFiles,
        rowProjection: projection,
        setSelectedPath
      })
    )

    expect(projection.hasPath).toHaveBeenCalledWith('/repo/wt/src/index.ts')
    expect(setSelectedPath).toHaveBeenCalledWith('/repo/wt/src/index.ts')
  })

  it('triggers auto-reveal for unstaged working-tree diff tabs', () => {
    const setSelectedPath = vi.fn()
    const openFiles: OpenFile[] = [
      {
        id: 'diff-1',
        filePath: '/repo/wt/src/app.ts',
        relativePath: 'src/app.ts',
        worktreeId: 'wt-1',
        language: 'typescript',
        isDirty: false,
        mode: 'diff',
        diffSource: 'unstaged'
      }
    ]
    const projection = mockProjection(true, 2)

    renderHook(() =>
      useFileExplorerAutoReveal({
        ...defaultParams,
        activeFileId: 'diff-1',
        openFiles,
        rowProjection: projection,
        setSelectedPath
      })
    )

    expect(setSelectedPath).toHaveBeenCalledWith('/repo/wt/src/app.ts')
  })

  it('triggers auto-reveal for staged working-tree diff tabs', () => {
    const setSelectedPath = vi.fn()
    const openFiles: OpenFile[] = [
      {
        id: 'diff-staged',
        filePath: '/repo/wt/src/staged.ts',
        relativePath: 'src/staged.ts',
        worktreeId: 'wt-1',
        language: 'typescript',
        isDirty: false,
        mode: 'diff',
        diffSource: 'staged'
      }
    ]
    const projection = mockProjection(true, 1)

    renderHook(() =>
      useFileExplorerAutoReveal({
        ...defaultParams,
        activeFileId: 'diff-staged',
        openFiles,
        rowProjection: projection,
        setSelectedPath
      })
    )

    expect(setSelectedPath).toHaveBeenCalledWith('/repo/wt/src/staged.ts')
  })

  it('ignores commit diff tabs (from commit history)', () => {
    const setSelectedPath = vi.fn()
    const openFiles: OpenFile[] = [
      {
        id: 'diff-commit',
        filePath: '/repo/wt/src/commit.ts',
        relativePath: 'src/commit.ts',
        worktreeId: 'wt-1',
        language: 'typescript',
        isDirty: false,
        mode: 'diff',
        diffSource: 'commit'
      }
    ]
    const projection = mockProjection(true, 0)

    renderHook(() =>
      useFileExplorerAutoReveal({
        ...defaultParams,
        activeFileId: 'diff-commit',
        openFiles,
        rowProjection: projection,
        setSelectedPath
      })
    )

    expect(setSelectedPath).not.toHaveBeenCalled()
  })

  it('ignores branch diff tabs', () => {
    const setSelectedPath = vi.fn()
    const openFiles: OpenFile[] = [
      {
        id: 'diff-branch',
        filePath: '/repo/wt/src/branch.ts',
        relativePath: 'src/branch.ts',
        worktreeId: 'wt-1',
        language: 'typescript',
        isDirty: false,
        mode: 'diff',
        diffSource: 'branch'
      }
    ]
    const projection = mockProjection(true, 0)

    renderHook(() =>
      useFileExplorerAutoReveal({
        ...defaultParams,
        activeFileId: 'diff-branch',
        openFiles,
        rowProjection: projection,
        setSelectedPath
      })
    )

    expect(setSelectedPath).not.toHaveBeenCalled()
  })
})
