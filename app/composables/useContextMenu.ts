import { ref } from "vue"
import type { Ref } from "vue"

export interface ContextMenuPosition {
  x: number
  y: number
}

export interface UseContextMenuOptions {
  triggerTranslation: (autoExplain?: boolean) => void
  triggerExplanation: () => void
}

export interface UseContextMenuResult {
  contextMenuPosition: Ref<ContextMenuPosition | null>
  handleContextMenu: (e: MouseEvent) => void
  handleContextMenuCopy: () => void
  handleContextMenuTranslate: () => void
  handleContextMenuExplain: () => void
  closeContextMenu: () => void
}

export function useContextMenu(
  options: UseContextMenuOptions,
): UseContextMenuResult {
  const { triggerTranslation, triggerExplanation } = options
  const contextMenuPosition = ref<ContextMenuPosition | null>(null)

  const handleContextMenu = (e: MouseEvent) => {
    const windowSelection = window.getSelection()
    if (!windowSelection || windowSelection.isCollapsed) {
      return
    }

    const selectedText = windowSelection.toString().trim()
    if (!selectedText || selectedText.length === 0) {
      return
    }

    const range = windowSelection.getRangeAt(0)
    const container = range.commonAncestorContainer
    const pdfViewer = document.getElementById("pdf-viewer-container")
    if (!pdfViewer || !pdfViewer.contains(container as Node)) {
      return
    }

    e.preventDefault()
    contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  }
  const handleContextMenuCopy = () => {
    const windowSelection = window.getSelection()
    if (windowSelection) {
      const selectedText = windowSelection.toString()
      navigator.clipboard.writeText(selectedText)
    }
  }

  const handleContextMenuTranslate = () => {
    triggerTranslation(false)
  }
  const handleContextMenuExplain = () => {
    triggerExplanation()
  }
  const closeContextMenu = () => {}

  return {
    contextMenuPosition,
    closeContextMenu,
    handleContextMenu,
    handleContextMenuCopy,
    handleContextMenuExplain,
    handleContextMenuTranslate,
  }
}
