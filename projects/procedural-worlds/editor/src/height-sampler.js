// Separate lanes let a long export run while the inspector requests previews.
export function createHeightSampler() {
  let worker;
  let sequence = 0;
  const jobs = new Map();
  function failWorker(event) {
    for (const job of jobs.values()) {
      job.reject(new Error(event.message || "The height sampling worker could not deliver pixels."));
    }
    jobs.clear();
    worker.terminate();
    worker = undefined;
  }
  return (settings, size) => new Promise((resolve, reject) => {
    worker ??= new Worker(new URL("./height-worker.js", import.meta.url), { type: "module" });
    worker.onerror = failWorker;
    worker.onmessageerror = failWorker;
    worker.onmessage = ({ data }) => {
      const job = jobs.get(data.id);
      jobs.delete(data.id);
      if (data.error) {
        job.reject(new Error(data.error));
      } else {
        job.resolve(data.pixels);
      }
    };
    const id = ++sequence;
    worker.postMessage({ id, settings, size });
    jobs.set(id, { resolve, reject });
  });
}

// Only the current request may paint. While sampling, retain just the newest successor.
export function createPreviewQueue(sample, paint, reportError) {
  let latest;
  let busy = false;
  async function drain() {
    busy = true;
    while (latest) {
      const current = latest;
      latest = undefined;
      try {
        const pixels = await sample(current, 144);
        if (latest) {
          continue;
        } else {
          paint(pixels);
        }
      } catch (error) {
        if (latest) {
          continue;
        } else {
          reportError(error);
        }
      }
    }
    busy = false;
  }
  return (settings) => {
    latest = { ...settings };
    if (busy) {
      return;
    } else {
      void drain();
    }
  };
}
