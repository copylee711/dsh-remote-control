export declare const IDLE_MS: number;
export interface Device {
    id: string;
    name: string;
    createdAt: number;
    lastSeenAt: number;
    hash: string;
}
export interface PairingOptions {
    file: string;
    now?: () => number;
    onRevoke?: (id: string) => void;
    idleMs?: number;
}
/** Only hashes of device secrets reach disk. Pending claims live in memory. */
export declare class PairingService {
    private readonly options;
    private readonly devices;
    private readonly pending;
    private token?;
    private readonly now;
    readonly idleMs: number;
    constructor(options: PairingOptions);
    private save;
    private expire;
    issue(): {
        token: string;
        expiresAt: number;
    };
    invalidate(): void;
    request(token: string, userAgent: string): {
        id: string;
        key: string;
        expiresAt: number;
    };
    requests(): Array<{
        id: string;
        name: string;
        expiresAt: number;
    }>;
    approve(id: string): void;
    reject(id: string): void;
    claim(id: string, key: string): {
        state: 'pending' | 'approved' | 'rejected';
        credential?: string;
    };
    authenticate(credential: string | undefined): Device | undefined;
    list(): Array<Omit<Device, 'hash'>>;
    revoke(id: string): void;
    revokeAll(): void;
}
