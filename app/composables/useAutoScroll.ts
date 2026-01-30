import type { Ref, WatchSource, ShallowRef } from "vue"

// note: ScrollBehavior と ScrollLogicalPosition は
// TypeScriptの標準DOM型定義（lib.dom.d.ts）に含まれています
export interface AutoScrollOptions {
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
  inline?: ScrollLogicalPosition
}

const defaultOptions: AutoScrollOptions = {
  behavior: "smooth",
  block: "nearest",
  inline: "nearest",
}

export function useAutoScroll<T extends HTMLElement = HTMLElement>(
  deps: WatchSource[],
  options: AutoScrollOptions = {},
): ShallowRef<T | null> {
  const elementRef = shallowRef<T | null>(null) as ShallowRef<T | null>
  const mergedOptions = { ...defaultOptions, ...options }

  watch(
    deps,
    () => {
      if (elementRef.value) {
        elementRef.value.scrollIntoView({
          behavior: mergedOptions.behavior,
          block: mergedOptions.block,
          inline: mergedOptions.inline,
        })
      }
    },
    { flush: "post" },
  )

  return elementRef
}
