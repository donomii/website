import { createHeightmapPixels } from "./terrain.js";

self.onmessage = ({ data: { id, settings, size } }) => {
  try {
    const pixels = createHeightmapPixels(settings, size);
    self.postMessage({ id, pixels }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
