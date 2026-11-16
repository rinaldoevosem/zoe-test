/** The current instant. `ZOE_NOW` (ISO timestamp) pins it for demos and end-to-end tests. */
export function currentInstant(): number {
  const pinned = process.env.ZOE_NOW;
  return pinned && !Number.isNaN(Date.parse(pinned)) ? Date.parse(pinned) : Date.now();
}
