export function setImmediate<T>(callback: (err: Error, result: T) => void, err: Error, result: T): void {
  global.setImmediate(callback, err, result);
}
