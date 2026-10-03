/**
 * A choice list drawn by the app instead of the system's `<select>` menu: a
 * sheet from the bottom on a phone, a centred card on a wide screen. Options
 * can be grouped (models by provider).
 */
import * as React from 'react'
import { Icon } from './icons.js'
import { useBackClose } from './common.js'
const h = React.createElement

export interface Choice { value: string; label: string; group?: string; hint?: string; disabled?: boolean }

export function Picker({ label, value, choices, onChange, disabled, className = '', placeholder = '请选择', title }: {
  label: string; value: string; choices: Choice[]; onChange: (value: string) => void
  disabled?: boolean; className?: string; placeholder?: string; title?: string
}): React.ReactElement {
  const [open, setOpen] = React.useState(false), dialog = React.useRef<HTMLDialogElement>(null)
  React.useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])
  useBackClose(open, () => setOpen(false))
  const current = choices.find(choice => choice.value === value)
  const groups: Array<{ name: string; items: Choice[] }> = []
  for (const choice of choices) {
    const name = choice.group ?? ''
    const last = groups.at(-1)
    if (last && last.name === name) last.items.push(choice); else groups.push({ name, items: [choice] })
  }
  return h(React.Fragment, null,
    h('button', { type: 'button', className: `rc-picker ${className}`, 'aria-label': label, 'aria-haspopup': 'listbox', title, disabled, onClick: () => setOpen(true) },
      h('span', { className: 'rc-picker-value' }, current?.label ?? placeholder), h(Icon, { name: 'chevronDown' })),
    h('dialog', { ref: dialog, className: 'rc-picker-sheet', 'aria-label': label, onCancel: () => setOpen(false), onClose: () => setOpen(false),
      // A tap on the backdrop lands on the dialog element itself.
      onClick: (event: React.MouseEvent) => { if (event.target === event.currentTarget) setOpen(false) } },
      open ? h('div', { className: 'rc-picker-body' },
        h('div', { className: 'rc-picker-title' }, label),
        h('div', { className: 'rc-picker-list', role: 'listbox', 'aria-label': label },
          ...groups.map(group => h(React.Fragment, { key: group.name },
            group.name ? h('div', { className: 'rc-picker-group' }, group.name) : null,
            ...group.items.map(choice => h('button', { key: choice.value, type: 'button', role: 'option', className: 'rc-picker-option', 'aria-selected': choice.value === value, disabled: choice.disabled,
              onClick: () => { setOpen(false); if (choice.value !== value) onChange(choice.value) } },
              h('span', { className: 'rc-picker-label' }, choice.label, choice.hint ? h('small', null, choice.hint) : null),
              choice.value === value ? h(Icon, { name: 'check' }) : null)))))) : null))
}
