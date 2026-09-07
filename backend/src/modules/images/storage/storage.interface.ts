/**
 * `get`/`put` is the entire surface any storage backend needs to satisfy —
 * nothing above this knows or cares which one is behind it. An abstract
 * class (not a plain TS `interface`) so Nest can use it directly as a DI
 * token; `images.module.ts` binds the concrete implementation.
 */
export abstract class StorageService {
  abstract get(key: string): Promise<Buffer>;
  abstract put(key: string, data: Buffer): Promise<{ checksum: string }>;
}
