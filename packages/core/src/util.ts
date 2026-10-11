/** Own-property check that works on every Apps Script runtime (no Object.hasOwn). */
export function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}
