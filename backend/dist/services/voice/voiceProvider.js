/** Thrown by voice providers — message is safe to store/show; never contains a raw shell command or file contents. */
export class VoiceProviderError extends Error {
    kind;
    constructor(kind, message) {
        super(message);
        this.name = "VoiceProviderError";
        this.kind = kind;
    }
}
