export class RateLimiter {
  private next = 0;
  constructor(private rate = 1) {}
  async wait() {
    const delay = Math.max(0, this.next - Date.now());
    if (delay) await new Promise((r) => setTimeout(r, delay));
    this.next = Date.now() + 1000 / this.rate;
  }
}
