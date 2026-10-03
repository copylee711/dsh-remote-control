import * as React from 'react'
const paths: Record<string, string> = { menu: 'M4 6h16M4 12h16M4 18h16', close: 'm6 6 12 12M18 6 6 18', more: 'M5 12h.01M12 12h.01M19 12h.01', plus: 'M12 5v14M5 12h14', send: 'M12 19V5m-6 6 6-6 6 6', chat: 'M4 4h16v13H8l-4 4V4', settings: 'M4 7h16M4 17h16M8 4v6M16 14v6', file: 'M5 3h9l5 5v13H5V3m9 0v6h5' }
export function Icon({ name }: { name: string }) {
  return React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, React.createElement('path', { d: paths[name] || paths.chat }))
}
