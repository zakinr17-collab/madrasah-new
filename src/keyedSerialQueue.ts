export class KeyedSerialQueue {
  private tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T> | T): Promise<T> {
    const normalizedKey = String(key);
    const previous = this.tails.get(normalizedKey) || Promise.resolve();

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.catch(() => undefined).then(() => gate);
    this.tails.set(normalizedKey, tail);

    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(normalizedKey) === tail) {
        this.tails.delete(normalizedKey);
      }
    }
  }

  get pendingKeys(): number {
    return this.tails.size;
  }
}
