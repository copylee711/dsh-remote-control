import * as React from 'react'
const paths: Record<string, string> = {
  menu: 'M5 8h14M5 15h9',
  close: 'm6 6 12 12M18 6 6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  send: 'M12 19V5m-6 6 6-6 6 6',
  stop: 'M8 8h8v8H8z',
  chat: 'M4 4h16v13H8l-4 4V4',
  compose: 'M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 8.5-8.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 2',
  plug: 'M9 3v5m6-5v5M6 8h12v3a6 6 0 0 1-12 0V8zm6 9v4',
  archive: 'M4 5h16v4H4zM6 9v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9m-8 4h4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.500 7.500 0 0 0-2.200 1.300l-2.300-.900-2 3.400 2 1.500a7.400 7.400 0 0 0 0 2.600l-2 1.500 2 3.400 2.300-.900a7.500 7.500 0 0 0 2.200 1.300l.400 2.400h4l.400-2.400a7.500 7.500 0 0 0 2.200-1.300l2.300.900 2-3.400-2-1.500c.07-.4.1-.9.1-1.300z',
  sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5',
  back: 'M15 5l-7 7 7 7',
  chevron: 'm9 6 6 6-6 6',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.5M4 4v4h4m-4 5a8 8 0 0 0 14.3 4.5M20 20v-4h-4',
  chevronDown: 'm6 9 6 6 6-6',
  check: 'm5 12 5 5 9-10',
  down: 'M12 5v14m-6-6 6 6 6-6',
  file: 'M5 3h9l5 5v13H5V3m9 0v6h5',
}
export function Icon({ name }: { name: string }) {
  return React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, React.createElement('path', { d: paths[name] || paths.chat }))
}
