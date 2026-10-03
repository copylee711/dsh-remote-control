import type { ServerResponse } from 'node:http';
import type { PairingService } from './pairing.js';
export declare const MANAGE_PATH = "/api/dsh-remote-control/manage";
export interface GatewayOptions {
    pairing: PairingService;
    upstreamPort: number;
    upstreamCookie: () => string;
    manage: (input: Record<string, unknown>, local: boolean) => Promise<unknown>;
    /** Render the official Web GUI when the Desktop Host has no HTTP index. */
    index?: () => Promise<string>;
    asset?: (path: string, res: ServerResponse) => Promise<boolean>;
}
export declare function safePath(path: string): boolean;
/** Authenticates every remote request before the privileged loopback leg. */
export declare class Gateway {
    private readonly options;
    private server?;
    private readonly sockets;
    private readonly active;
    private readonly wss;
    private readonly rates;
    private readonly authorities;
    private readonly proof;
    port: number;
    constructor(options: GatewayOptions);
    allowAuthority(authority: string): void;
    disallowAuthority(authority: string): void;
    private validHost;
    listen(host: '127.0.0.1' | '0.0.0.0', port?: number): Promise<number>;
    healthURL(base: string): string;
    verifyHealth(value: unknown): boolean;
    private track;
    onlineIds(): string[];
    revoke(id: string): void;
    private device;
    private cookieHeader;
    private rate;
    private handle;
    private headers;
    private proxy;
    private upgrade;
    private sse;
    close(): Promise<void>;
}
