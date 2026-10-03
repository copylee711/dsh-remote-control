import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "@copylee/dsh-remote-control";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    gatewayPort: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    gatewayPort: z<number, number, "defined">;
}>>, "plain">;
export interface Config {
    gatewayPort?: number;
}
/** Exchange the Host's launch token entirely inside the process. */
export declare function hostCookie(connection: Context['connection'], port: number): string;
export declare function apply(ctx: Context, config?: Config): Promise<void>;
