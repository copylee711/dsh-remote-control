/**
 * DSH 0.2.1's footer action seat is above the account row; the account row has
 * no public trailing-action seat. Mount only our own portal container beside
 * its launcher and native indicators, without positioning over Host controls.
 * If the known row shape changes, retain the ordinary footer-slot fallback.
 */
export function mountInlineSidebarAction(anchor: HTMLElement, changed: (target: HTMLElement | null) => void): () => void {
  const actions = anchor.closest<HTMLElement>('[class*="footerActions"]')
  const footer = actions?.parentElement
  if (!actions || !footer) return () => {}
  let container: HTMLElement | null = null
  const sync = () => {
    const settings = actions.nextElementSibling
    const row = settings?.querySelector<HTMLElement>('[class*="triggerRow"]')
    const valid = row && getComputedStyle(row).display === 'flex' && row.querySelector('button')
    if (valid && container?.parentElement === row) return
    if (!valid && !container) return
    container?.remove(); container = null
    if (valid) {
      container = document.createElement('span')
      container.className = 'dsrc-inline-action'
      // The launcher stays first; our control precedes native connection/update indicators.
      row.insertBefore(container, row.children[1] ?? null)
    }
    changed(container)
  }
  const observer = new MutationObserver(sync)
  observer.observe(footer, { childList: true, subtree: true })
  sync()
  return () => { observer.disconnect(); container?.remove() }
}
