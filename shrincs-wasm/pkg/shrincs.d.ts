/* tslint:disable */
/* eslint-disable */

export enum ParamsType {
    L = 0,
    B = 1,
    B32 = 2,
}

export function initThreadPool(num_threads: number): Promise<any>;

export function initialState(): Uint8Array;

export function keygen(params: ParamsType): Uint8Array;

export function keypairFromSeed(params: ParamsType, seed: Uint8Array): Uint8Array;

export function keypairLen(): number;

export function preparedStatelessKeyLen(params: ParamsType): number;

export function publicKeyFromKeypair(keypair: Uint8Array): Uint8Array;

export function publicKeyLen(): number;

export function secretKeyFromKeypair(keypair: Uint8Array): Uint8Array;

export function secretKeyLen(): number;

export function signStateful(params: ParamsType, message: Uint8Array, secret_key: Uint8Array, state: Uint8Array): Uint8Array;

export function signStateless(params: ParamsType, message: Uint8Array, secret_key: Uint8Array): Uint8Array;

export function signStatelessPrepare(params: ParamsType, secret_key: Uint8Array): Uint8Array;

export function signStatelessWithPrepare(params: ParamsType, message: Uint8Array, secret_key: Uint8Array, prepared_key: Uint8Array): Uint8Array;

export function signatureFromStatefulSignResult(result: Uint8Array): Uint8Array;

export function stateCounter(state: Uint8Array): number;

export function stateFromStatefulSignResult(result: Uint8Array): Uint8Array;

export function stateLen(): number;

export function statefulSignatureMaxLen(params: ParamsType): number;

export function statelessSignatureLen(params: ParamsType): number;

export function verify(params: ParamsType, message: Uint8Array, signature: Uint8Array, public_key: Uint8Array): boolean;

export function verifyStateful(params: ParamsType, message: Uint8Array, signature: Uint8Array, public_key: Uint8Array): boolean;

export class wbg_rayon_PoolBuilder {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    build(): void;
    numThreads(): number;
    receiver(): number;
}

export function wbg_rayon_start_worker(receiver: number): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly initialState: () => [number, number];
    readonly keygen: (a: number) => [number, number, number, number];
    readonly keypairFromSeed: (a: number, b: number, c: number) => [number, number, number, number];
    readonly keypairLen: () => number;
    readonly preparedStatelessKeyLen: (a: number) => number;
    readonly publicKeyFromKeypair: (a: number, b: number) => [number, number, number, number];
    readonly publicKeyLen: () => number;
    readonly secretKeyFromKeypair: (a: number, b: number) => [number, number, number, number];
    readonly secretKeyLen: () => number;
    readonly signStateful: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly signStateless: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly signStatelessPrepare: (a: number, b: number, c: number) => [number, number, number, number];
    readonly signStatelessWithPrepare: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly signatureFromStatefulSignResult: (a: number, b: number) => [number, number, number, number];
    readonly stateCounter: (a: number, b: number) => [number, number, number];
    readonly stateFromStatefulSignResult: (a: number, b: number) => [number, number, number, number];
    readonly stateLen: () => number;
    readonly statefulSignatureMaxLen: (a: number) => number;
    readonly statelessSignatureLen: (a: number) => number;
    readonly verify: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly verifyStateful: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly __wbg_wbg_rayon_poolbuilder_free: (a: number, b: number) => void;
    readonly initThreadPool: (a: number) => any;
    readonly wbg_rayon_poolbuilder_build: (a: number) => void;
    readonly wbg_rayon_poolbuilder_numThreads: (a: number) => number;
    readonly wbg_rayon_poolbuilder_receiver: (a: number) => number;
    readonly wbg_rayon_start_worker: (a: number) => void;
    readonly memory: WebAssembly.Memory;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_thread_destroy: (a?: number, b?: number, c?: number) => void;
    readonly __wbindgen_start: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput, memory?: WebAssembly.Memory, thread_stack_size?: number }} module - Passing `SyncInitInput` directly is deprecated.
 * @param {WebAssembly.Memory} memory - Deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput, memory?: WebAssembly.Memory, thread_stack_size?: number } | SyncInitInput, memory?: WebAssembly.Memory): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput>, memory?: WebAssembly.Memory, thread_stack_size?: number }} module_or_path - Passing `InitInput` directly is deprecated.
 * @param {WebAssembly.Memory} memory - Deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput>, memory?: WebAssembly.Memory, thread_stack_size?: number } | InitInput | Promise<InitInput>, memory?: WebAssembly.Memory): Promise<InitOutput>;
