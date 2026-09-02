import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Sidebar } from '@/components/Sidebar'
import { PrototypeNav } from '@/components/PrototypeNav'
import { generateSingleTaskAI, generateWorksheetAI } from '@/data/ai'
import type { GenerateMode } from '@/data/ai'
import {
  createEmptyBlock,
  generateWorksheet,
} from '@/data/generator'
import {
  emptyDraft,
  filledCreateDraft,
  loadWorksheet,
  uid,
} from '@/data/worksheet'
import { cloneBlock, isPageEmpty, removePageFromDraft, syncPagesFromBreaks } from '@/data/blockUtils'
import type { BlockPreviewState, Modal, NavId, Screen, TaskType, WorksheetBlock, WorksheetDraft } from '@/data/worksheet'
import { Home } from '@/screens/Home'
import { Create } from '@/screens/Create'
import { Loader } from '@/screens/Loader'
import { WorksheetScreen } from '@/screens/Worksheet'
import { Modals } from '@/screens/Modals'
import { WorksheetsList } from '@/screens/WorksheetsList'
import { ComingSoon } from '@/screens/ComingSoon'
import { PrintScreen } from '@/screens/Print'

function demoDraft(): WorksheetDraft {
  return generateWorksheet({
    ...filledCreateDraft(),
    topic: 'Закрепление материала',
    title: 'Закрепление материала',
    wishes: 'Класс только начал тему',
  })
}

const SHELL_SCREENS: Screen[] = ['home', 'worksheets-list', 'coming-soon']

function navFromScreen(screen: Screen, stubNav: NavId): NavId {
  if (screen === 'home') return 'desk'
  if (screen === 'worksheets-list') return 'materials'
  if (screen === 'coming-soon') return stubNav
  return 'desk'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [stubNav, setStubNav] = useState<NavId>('ai')
  const [createOpen, setCreateOpen] = useState(false)
  const [createAdvanced, setCreateAdvanced] = useState(false)
  const [draft, setDraftState] = useState<WorksheetDraft>(() => demoDraft())
  const [modal, setModal] = useState<Modal>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [deletePageIndex, setDeletePageIndex] = useState<number | null>(null)
  const [pendingGenerate, setPendingGenerate] = useState(false)
  const [generateMode, setGenerateMode] = useState<GenerateMode>('create')
  const [generateTaskType, setGenerateTaskType] = useState<TaskType>('short_answer')
  const [generateTaskHint, setGenerateTaskHint] = useState('')
  const [generateTaskBusy, setGenerateTaskBusy] = useState(false)
  const [blockPreviewState, setBlockPreviewState] = useState<BlockPreviewState | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [listRefresh, setListRefresh] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toastTimer = useRef<number | null>(null)
  const draftRef = useRef(draft)
  const generateModeRef = useRef<GenerateMode>('create')
  const historyRef = useRef<WorksheetDraft[]>([])
  const historyIdxRef = useRef(-1)
  const skipHistoryRef = useRef(false)
  draftRef.current = draft
  generateModeRef.current = generateMode

  const pushHistory = useCallback((next: WorksheetDraft) => {
    const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1)
    trimmed.push(JSON.parse(JSON.stringify(next)) as WorksheetDraft)
    if (trimmed.length > 20) trimmed.shift()
    historyRef.current = trimmed
    historyIdxRef.current = trimmed.length - 1
  }, [])

  const setDraft = useCallback(
    (updater: WorksheetDraft | ((prev: WorksheetDraft) => WorksheetDraft)) => {
      setDraftState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (!skipHistoryRef.current) pushHistory(next)
        return next
      })
    },
    [pushHistory],
  )

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current -= 1
    skipHistoryRef.current = true
    setDraftState(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])) as WorksheetDraft)
    skipHistoryRef.current = false
  }, [])

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current += 1
    skipHistoryRef.current = true
    setDraftState(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])) as WorksheetDraft)
    skipHistoryRef.current = false
  }, [])

  useEffect(() => {
    pushHistory(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = (message: string) => {
    setToastMessage(message)
    setModal('toast')
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setModal(null)
      setToastMessage('')
    }, 2800)
  }

  useEffect(() => {
    if (!sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sidebarOpen])

  useEffect(() => {
    if (screen !== 'loader') return
    let cancelled = false
    const started = Date.now()
    const mode = generateModeRef.current

    ;(async () => {
      try {
        const next = await generateWorksheetAI(draftRef.current, mode)
        const wait = Math.max(0, 900 - (Date.now() - started))
        await new Promise((r) => window.setTimeout(r, wait))
        if (cancelled) return
        setDraft(syncPagesFromBreaks(next))
        setPendingGenerate(false)
        setCurrentPage(0)
        setSelectedBlockId(null)
        setCreateOpen(false)
        setScreen(mode === 'regenerate' ? 'edit' : 'preview')
        if (mode === 'regenerate') showToast('Рабочий лист перегенерирован')
      } catch (err) {
        if (cancelled) return
        setPendingGenerate(false)
        if (mode === 'regenerate') {
          setScreen('edit')
        } else {
          setCreateOpen(true)
          setScreen('home')
        }
        showToast(err instanceof Error ? err.message : 'Ошибка генерации')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [screen, setDraft])

  useEffect(() => {
    if (screen === 'edit-widget' && !selectedBlockId && draft.blocks[0]) {
      setSelectedBlockId(draft.blocks[0].id)
    }
  }, [screen, selectedBlockId, draft.blocks])

  useEffect(() => {
    if (
      screen === 'edit' ||
      screen === 'edit-widget' ||
      screen === 'preview' ||
      screen === 'show-answers' ||
      screen === 'print'
    ) {
      setDraft((d) => syncPagesFromBreaks(d))
    }
  }, [screen])

  const openCreate = (advanced = false) => {
    setDraft(emptyDraft())
    setCreateAdvanced(advanced)
    setCreateOpen(true)
  }

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateAdvanced(false)
  }

  const submitCreate = (createMode: 'generate' | 'manual' = 'generate') => {
    setCreateOpen(false)
    setCreateAdvanced(false)
    setDraft((d) => ({
      ...d,
      title: d.topic || d.title,
      blocks: createMode === 'manual' ? [] : d.blocks,
      intro: createMode === 'manual' ? '' : d.intro,
    }))
    if (createMode === 'manual') {
      setSelectedBlockId(null)
      setScreen('edit')
      return
    }
    setPendingGenerate(true)
    setGenerateMode('create')
    setScreen('loader')
  }

  const updateBlock = (block: WorksheetBlock) => {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === block.id ? block : b)),
    }))
  }

  const addBlock = (type: TaskType, insertBeforeId?: string | null) => {
    if (type === 'page_break') {
      const block = createEmptyBlock('page_break', currentPage, draft.subject)
      setDraft((d) =>
        syncPagesFromBreaks({
          ...d,
          blocks: insertBlockInPage(d.blocks, block, currentPage, insertBeforeId),
        }),
      )
      setCurrentPage(currentPage + 1)
      setSelectedBlockId(null)
      setScreen('edit')
      return
    }
    const block = createEmptyBlock(type, currentPage, draft.subject)
    setDraft((d) =>
      syncPagesFromBreaks({
        ...d,
        blocks: insertBlockInPage(d.blocks, block, currentPage, insertBeforeId),
      }),
    )
    setSelectedBlockId(block.id)
    setScreen('edit')
  }

  const removeBlock = (id: string) => {
    setDraft((d) => syncPagesFromBreaks({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }))
    setSelectedBlockId(null)
    setScreen('edit')
  }

  const duplicateBlock = (id: string) => {
    const source = draft.blocks.find((b) => b.id === id)
    if (!source) return
    const copy = cloneBlock(source)
    setDraft((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id)
      if (idx < 0) return d
      const blocks = [...d.blocks]
      blocks.splice(idx + 1, 0, copy)
      return syncPagesFromBreaks({ ...d, blocks })
    })
    setSelectedBlockId(copy.id)
    setScreen('edit')
    showToast(source.issued ? 'Создана копия выданного задания' : 'Блок скопирован')
  }

  const moveBlock = (id: string, dir: -1 | 1) => {
    setDraft((d) =>
      syncPagesFromBreaks(
        reorderPageBlocks(d, currentPage, (pageBlocks) => {
          const idx = pageBlocks.findIndex((b) => b.id === id)
          const swap = idx + dir
          if (idx < 0 || swap < 0 || swap >= pageBlocks.length) return pageBlocks
          const next = [...pageBlocks]
          ;[next[idx], next[swap]] = [next[swap], next[idx]]
          return next
        }),
      ),
    )
  }

  const reorderBlock = (
    fromId: string,
    toId: string,
    position: 'before' | 'after' = 'before',
  ) => {
    if (fromId === toId) return
    setDraft((d) =>
      syncPagesFromBreaks(
        reorderPageBlocks(d, currentPage, (pageBlocks) => {
          const fromIdx = pageBlocks.findIndex((b) => b.id === fromId)
          let toIdx = pageBlocks.findIndex((b) => b.id === toId)
          if (fromIdx < 0 || toIdx < 0) return pageBlocks
          const next = [...pageBlocks]
          const [item] = next.splice(fromIdx, 1)
          if (fromIdx < toIdx) toIdx -= 1
          const insertIdx = position === 'after' ? toIdx + 1 : toIdx
          next.splice(insertIdx, 0, item)
          return next
        }),
      ),
    )
  }

  const addPage = () => {
    setDraft((d) => ({ ...d, pages: d.pages + 1 }))
    setCurrentPage(draft.pages)
  }

  const confirmRemovePage = (page: number) => {
    setDraft((d) => syncPagesFromBreaks(removePageFromDraft(d, page)))
    setCurrentPage((prev) => {
      if (prev > page) return prev - 1
      if (prev === page) return Math.max(0, page - 1)
      return prev
    })
    setSelectedBlockId(null)
    setScreen('edit')
    setDeletePageIndex(null)
    setModal(null)
    showToast('Страница удалена')
  }

  const requestRemovePage = (page: number) => {
    if (draft.pages <= 1) return
    if (isPageEmpty(draft.blocks, page)) {
      confirmRemovePage(page)
      return
    }
    setDeletePageIndex(page)
    setModal('delete-page')
  }

  const confirmGenerateTask = async () => {
    if (generateTaskBusy) return
    setGenerateTaskBusy(true)
    try {
      const block = await generateSingleTaskAI(draft, generateTaskType, generateTaskHint)
      block.page = currentPage
      setDraft((d) =>
        syncPagesFromBreaks({
          ...d,
          blocks: [...d.blocks, block],
          taskCount: d.taskCount + 1,
        }),
      )
      setSelectedBlockId(block.id)
      setModal(null)
      setGenerateTaskHint('')
      setScreen('edit')
      showToast('Задание добавлено')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ошибка генерации задания')
    } finally {
      setGenerateTaskBusy(false)
    }
  }

  const handleSave = () => {
    const saved = { ...draft, savedAt: new Date().toISOString() }
    setDraft(saved)
    localStorage.setItem(`worksheet:${saved.id}`, JSON.stringify(saved))
    setListRefresh((n) => n + 1)
    setModal(null)
    showToast('Рабочий лист сохранён')
  }

  const handlePrint = () => {
    setModal(null)
    const prevAnswers = draft.showAnswers
    if (draft.print.answersSeparate) {
      setDraft((d) => ({ ...d, showAnswers: false }))
      window.setTimeout(() => {
        window.print()
        setDraft((d) => ({ ...d, showAnswers: true }))
        window.setTimeout(() => {
          window.print()
          setDraft((d) => ({ ...d, showAnswers: prevAnswers }))
        }, 400)
      }, 100)
    } else {
      window.setTimeout(() => window.print(), 50)
    }
  }

  const navigateNav = (id: NavId) => {
    setSidebarOpen(false)
    if (id === 'desk') {
      setScreen('home')
      return
    }
    if (id === 'materials') {
      setScreen('worksheets-list')
      return
    }
    setStubNav(id)
    setScreen('coming-soon')
  }

  const openWorksheet = (id: string) => {
    const loaded = loadWorksheet(id)
    if (!loaded) {
      showToast('Не удалось открыть рабочий лист')
      return
    }
    setDraft(loaded)
    setCurrentPage(0)
    setSelectedBlockId(null)
    setScreen('edit')
  }

  const goScreen = (next: Screen) => {
    if (next === 'create') {
      setDraft(emptyDraft())
      setCreateOpen(true)
      setCreateAdvanced(false)
      setScreen('home')
      return
    }
    if (next === 'create-advanced') {
      setDraft(emptyDraft())
      setCreateOpen(true)
      setCreateAdvanced(true)
      setScreen('home')
      return
    }
    if (next === 'create-filled') {
      setDraft(filledCreateDraft())
      setCreateOpen(true)
      setCreateAdvanced(true)
      setScreen('home')
      return
    }
    if (next === 'worksheets-list') {
      setScreen('worksheets-list')
      return
    }
    if (next === 'coming-soon') {
      setStubNav('ai')
      setScreen('coming-soon')
      return
    }
    if (
      (next === 'preview' ||
        next === 'edit' ||
        next === 'show-answers' ||
        next === 'edit-widget' ||
        next === 'add-block' ||
        next === 'print') &&
      draft.blocks.length === 0 &&
      !pendingGenerate
    ) {
      setDraft(demoDraft())
    }
    setScreen(next)
  }

  const worksheetMode =
    screen === 'preview'
      ? 'preview'
      : screen === 'show-answers'
        ? 'answers'
        : screen === 'edit-widget'
          ? 'edit-widget'
          : screen === 'add-block'
            ? 'add-block'
            : 'edit'

  const activeNav = navFromScreen(screen, stubNav)
  const showCreateOverlay =
    createOpen &&
    (SHELL_SCREENS.includes(screen) ||
      screen === 'create' ||
      screen === 'create-advanced' ||
      screen === 'create-filled')

  return (
    <>
      {SHELL_SCREENS.includes(screen) ? (
        <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
          {sidebarOpen ? (
            <button
              type="button"
              className="sidebar-backdrop"
              aria-label="Закрыть меню"
              onClick={() => setSidebarOpen(false)}
            />
          ) : null}
          <Sidebar
            activeId={activeNav}
            mobileOpen={sidebarOpen}
            onMobileToggle={() => setSidebarOpen((v) => !v)}
            onNavigate={navigateNav}
            onSoon={showToast}
          />
          <div className="main-pane">
            <header className="mobile-topbar">
              <button
                type="button"
                className="mobile-menu-btn"
                aria-label="Открыть меню"
                onClick={() => setSidebarOpen(true)}
              >
                <span />
                <span />
                <span />
              </button>
              <span className="mobile-topbar-title">Ассистент Преподавателя</span>
            </header>
            <div className="main-card">
              {screen === 'home' ? (
                <Home onCreateWorksheet={() => openCreate()} onSoon={showToast} />
              ) : null}
              {screen === 'worksheets-list' ? (
                <WorksheetsList
                  refreshKey={listRefresh}
                  onHome={() => setScreen('home')}
                  onCreate={() => openCreate()}
                  onOpen={openWorksheet}
                  onDelete={() => setListRefresh((n) => n + 1)}
                />
              ) : null}
              {screen === 'coming-soon' ? (
                <ComingSoon navId={stubNav} onHome={() => setScreen('home')} />
              ) : null}
            </div>
          </div>
          {showCreateOverlay ? (
            <div className="create-overlay">
              <Create
                overlay
                draft={draft}
                advancedOpen={createAdvanced || screen === 'create-advanced' || screen === 'create-filled'}
                onChange={setDraft}
                onClose={closeCreate}
                onSubmit={submitCreate}
                onSoon={showToast}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {screen === 'loader' ? (
        <Loader
          title={draft.title || draft.topic || 'Рабочий лист'}
          message={
            generateMode === 'regenerate'
              ? 'Пересобираю задания…'
              : 'Думаю над темой'
          }
          onHome={() => setScreen('home')}
        />
      ) : null}

      {screen === 'preview' ||
      screen === 'edit' ||
      screen === 'edit-widget' ||
      screen === 'add-block' ||
      screen === 'show-answers' ? (
        <ErrorBoundary onReset={() => setScreen('edit')}>
          <WorksheetScreen
          draft={draft}
          mode={worksheetMode}
          selectedBlockId={selectedBlockId}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onSelectBlock={(id) => {
            setSelectedBlockId(id)
            if (screen !== 'edit' && screen !== 'add-block') {
              setScreen('edit')
            }
          }}
          onChangeBlock={updateBlock}
          onChangeDraft={setDraft}
          onAddBlock={addBlock}
          onRemoveBlock={removeBlock}
          onDuplicateBlock={duplicateBlock}
          onMoveBlock={moveBlock}
          onReorderBlock={reorderBlock}
          onAddPage={addPage}
          onRemovePage={requestRemovePage}
          onBack={() => setScreen('home')}
          onMaterials={() => setScreen('worksheets-list')}
          onEdit={() => setScreen('edit')}
          onPreview={() => setScreen('preview')}
          onConvert={() => setModal('convert')}
          onDownload={() => setScreen('print')}
          onMenu={() => setModal('menu')}
          onSettings={() => setModal('settings')}
          onShowAnswers={() => {
            setDraft((d) => ({ ...d, showAnswers: !d.showAnswers }))
            setScreen((s) => (s === 'show-answers' ? 'preview' : 'show-answers'))
          }}
          onAddBlockOpen={() => setScreen('edit')}
          onCloseAddBlock={() => setScreen('edit')}
          onGenerateTask={() => setModal('generate-task')}
          onRegenerate={() => setModal('regenerate')}
          onSave={handleSave}
          onUndo={undo}
          onRedo={redo}
          onSoon={showToast}
          blockPreviewState={blockPreviewState}
        />
        </ErrorBoundary>
      ) : null}

      {screen === 'print' ? (
        <PrintScreen
          draft={draft}
          onChangeDraft={setDraft}
          onBack={() => setScreen('preview')}
          onPrint={handlePrint}
          onPdf={() => showToast('PDF в разработке')}
        />
      ) : null}

      <Modals
        modal={modal}
        draft={draft}
        generateTaskType={generateTaskType}
        generateTaskHint={generateTaskHint}
        generateTaskBusy={generateTaskBusy}
        toastMessage={toastMessage}
        deletePageIndex={deletePageIndex}
        onClose={() => {
          setModal(null)
          setDeletePageIndex(null)
        }}
        onOpen={setModal}
        onChangeDraft={setDraft}
        onGenerateTaskType={setGenerateTaskType}
        onGenerateTaskHint={setGenerateTaskHint}
        onConfirmConvert={() => setModal('convert-success')}
        onConfirmDuplicate={() => {
          setDraft((d) => ({
            ...d,
            id: uid('ws'),
            title: `${d.title} (копия)`,
          }))
          setModal(null)
          showToast('Создана копия')
        }}
        onConfirmDelete={() => {
          setModal(null)
          setDraft(emptyDraft())
          setScreen('home')
          showToast('Рабочий лист удалён')
        }}
        onConfirmDeletePage={() => {
          if (deletePageIndex !== null) confirmRemovePage(deletePageIndex)
        }}
        onConfirmRegenerate={() => {
          if (!draft.topic.trim()) {
            setModal('regenerate-empty-topic')
            return
          }
          setModal(null)
          setPendingGenerate(true)
          setGenerateMode('regenerate')
          setScreen('loader')
        }}
        onConfirmGenerateTask={confirmGenerateTask}
        onPrint={handlePrint}
        onSave={handleSave}
        onSoon={showToast}
      />

      <PrototypeNav
        screen={screen}
        onScreen={goScreen}
        onModal={setModal}
        blockPreviewState={blockPreviewState}
        onBlockPreviewState={setBlockPreviewState}
        hidden={showCreateOverlay}
      />
    </>
  )
}

function reorderPageBlocks(
  draft: WorksheetDraft,
  page: number,
  mutate: (pageBlocks: WorksheetBlock[]) => WorksheetBlock[],
): WorksheetDraft {
  const pageBlocks = draft.blocks.filter((b) => b.page === page)
  const others = draft.blocks.filter((b) => b.page !== page)
  return { ...draft, blocks: [...others, ...mutate(pageBlocks)] }
}

function insertBlockInPage(
  blocks: WorksheetBlock[],
  block: WorksheetBlock,
  page: number,
  insertBeforeId?: string | null,
): WorksheetBlock[] {
  const pageBlocks = blocks.filter((b) => b.page === page)
  const others = blocks.filter((b) => b.page !== page)

  if (!insertBeforeId) {
    return [...others, ...pageBlocks, block]
  }

  const idx = pageBlocks.findIndex((b) => b.id === insertBeforeId)
  if (idx < 0) {
    return [...others, ...pageBlocks, block]
  }

  const next = [...pageBlocks]
  next.splice(idx, 0, block)
  return [...others, ...next]
}
