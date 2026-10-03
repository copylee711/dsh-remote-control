import type { Gateway } from './gateway.js';
export type TunnelPhase = 'off' | 'downloading' | 'starting' | 'verifying' | 'ready' | 'error';
export declare class TunnelManager {
    private readonly gateway;
    phase: TunnelPhase;
    url?: string;
    error?: string;
    private child?;
    private generation;
    private timer?;
    private monitor?;
    private failures;
    private checking;
    private lastFailure;
    private proxy?;
    constructor(gateway: Gateway);
    start(proxy?: string): Promise<void>;
    private probe;
    private fail;
    private closeChild;
    stop(): Promise<void>;
}
