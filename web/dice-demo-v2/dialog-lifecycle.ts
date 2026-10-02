// SPDX-License-Identifier: MIT
import { useEffect, type PointerEvent } from 'react';
export function isBackdropPointer(event: PointerEvent<HTMLDialogElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.target === event.currentTarget &&
    (event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom)
  );
}

let menuLockCount = 0;
let restoreMenuScroll: (() => void) | undefined;
function releaseMenuScroll() { if (--menuLockCount === 0) { restoreMenuScroll?.(); restoreMenuScroll = undefined; } }

/** Fixed-body lock also prevents Safari rubber-banding behind native dialogs. */
export function useMenuScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    if (++menuLockCount > 1) return releaseMenuScroll;
    const x = window.scrollX,
      y = window.scrollY;
    const body = document.body.style,
      root = document.documentElement.style;
    const patches: [CSSStyleDeclaration, string, string][] = [
      [body, 'position', 'fixed'],
      [body, 'top', `${-y}px`],
      [body, 'left', `${-x}px`],
      [body, 'width', '100%'],
      [body, 'overflow', 'hidden'],
      [root, 'overflow', 'hidden'],
      [root, 'overscroll-behavior', 'none'],
    ];
    const saved = patches.map(([style, property]) => ({
      style,
      property,
      value: style.getPropertyValue(property),
      priority: style.getPropertyPriority(property),
    }));
    for (const [style, property, value] of patches) style.setProperty(property, value);
    restoreMenuScroll = () => {
      for (const { style, property, value, priority } of saved) {
        if (value) style.setProperty(property, value, priority);
        else style.removeProperty(property);
      }
      const behavior = root.getPropertyValue('scroll-behavior'),
        priority = root.getPropertyPriority('scroll-behavior');
      root.setProperty('scroll-behavior', 'auto', 'important');
      window.scrollTo(x, y);
      if (behavior) root.setProperty('scroll-behavior', behavior, priority);
      else root.removeProperty('scroll-behavior');
    };
    return releaseMenuScroll;
  }, [open]);
}
