import type { IncomingMessage, ServerResponse } from 'node:http';
export declare function json(res: ServerResponse, status: number, value: unknown): void;
export declare function body(req: IncomingMessage, limit?: number): Promise<Record<string, unknown>>;
export declare function isLoopback(value: string | undefined): boolean;
export declare function cookie(req: IncomingMessage, name?: string): string | undefined;
export declare function sameOrigin(req: IncomingMessage): boolean;
