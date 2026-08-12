export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class ValidationError extends HttpError {
  constructor(
    message: string,
    public readonly errors: string[] = [message]
  ) {
    super(400, message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found.") {
    super(404, message);
    this.name = "NotFoundError";
  }
}
