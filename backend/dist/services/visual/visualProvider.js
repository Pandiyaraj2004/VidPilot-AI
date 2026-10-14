/** Message is safe to store/show. */
export class VisualProviderError extends Error {
    kind;
    constructor(kind, message) {
        super(message);
        this.name = "VisualProviderError";
        this.kind = kind;
    }
}
