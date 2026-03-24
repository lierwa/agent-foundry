export function toHttpError(error: unknown): { statusCode: number; message: string; error: string } {
  if (error instanceof Error) {
    const statusCode =
      typeof (error as Error & { statusCode?: unknown }).statusCode === "number"
        ? ((error as Error & { statusCode: number }).statusCode)
        : 400;

    return {
      statusCode,
      error: statusCode >= 500 ? "Internal Server Error" : "Bad Request",
      message: error.message,
    };
  }

  return {
    statusCode: 500,
    error: "Internal Server Error",
    message: "Unknown error",
  };
}
