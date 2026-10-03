import * as React from 'react';
interface ClientContext {
    effect(run: () => void | (() => void), label?: string): void;
    slots: {
        inject(name: string, setup: () => unknown): void;
        register(meta: Record<string, unknown>, render: (props: any) => unknown): unknown;
    };
}
export declare function RemoteControlPanel(): React.ReactElement;
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
