import type { IncomingMessage, ServerResponse } from 'node:http'
export function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' })
  res.end(JSON.stringify(value))
}
export async function body(req: IncomingMessage, limit = 16_384): Promise<Record<string, unknown>> {
  let size = 0; const chunks: Buffer[] = []
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw new Error('请求过大。'); chunks.push(Buffer.from(chunk)) }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求格式不正确。')
  return value as Record<string, unknown>
}
export function isLoopback(value: string | undefined): boolean { return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1' }
export function cookie(req: IncomingMessage, name = 'dsh_rc'): string | undefined {
  return req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1)
}
/**
 * Text travels compressed. The computer's upload is the narrow part of every remote connection,
 * and the app's scripts are several megabytes before compression.
 */
export function gzipFor(req: IncomingMessage | undefined, type: string | undefined): boolean {
  if (!req || !/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) return false
  // An event stream must reach the browser as it is written.
  return !!type && !type.includes('event-stream') && /^(text\/|application\/(javascript|json|manifest\+json|xml)|image\/svg)/.test(type)
}
export function sameOrigin(req: IncomingMessage): boolean {
  if (!req.headers.origin) return req.headers['sec-fetch-site'] !== 'cross-site'
  try { return new URL(req.headers.origin).host === req.headers.host } catch { return false }
}
