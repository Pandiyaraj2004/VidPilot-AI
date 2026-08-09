export interface StorageProvider {
  readonly name: string;
  save(key: string, filePath: string): Promise<string>;
  retrieve(key: string): Promise<string>;
}

/**
 * Abstraction over where rendered video files live between the render job
 * and the upload job (local disk, GitHub artifact, or cloud storage).
 * Firestore only ever stores metadata/job state, never the binary itself.
 * Concrete providers ship alongside the renderer/upload pipeline (Phase 5+).
 */
export class StorageService {
  constructor(private readonly provider: StorageProvider) {}

  async save(_key: string, _filePath: string): Promise<string> {
    throw new Error(`StorageService.save() is not implemented yet (provider: ${this.provider.name}).`);
  }

  async retrieve(_key: string): Promise<string> {
    throw new Error(`StorageService.retrieve() is not implemented yet (provider: ${this.provider.name}).`);
  }
}
