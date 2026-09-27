export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}
export function retryDelay(attempt: number, status: number) {
  return (status === 429 || status === 408 || status >= 500) && attempt < 3
    ? [1000, 5000, 30000][attempt]
    : null;
}
