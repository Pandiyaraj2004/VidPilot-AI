export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "HttpError";
    }
}
export class ValidationError extends HttpError {
    errors;
    constructor(message, errors = [message]) {
        super(400, message);
        this.errors = errors;
        this.name = "ValidationError";
    }
}
export class NotFoundError extends HttpError {
    constructor(message = "Not found.") {
        super(404, message);
        this.name = "NotFoundError";
    }
}
