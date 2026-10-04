import { createUFOCreatureModelLoadJobs } from './ufo-models.js?v=20261004-2';
import { createExtraCreatureModelLoadJobs } from './extra-models.js?v=20261004-2';
import { createGLTFCreatureModelLoadJobs } from './gltf-models.js?v=20261004-2';
import { createFBXCreatureModelLoadJobs } from './fbx-models.js?v=20261004-2';

const MAX_CONCURRENT_MODEL_LOADS = 2;
const MAX_MODEL_LOAD_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 700;
const TRANSIENT_LOAD_ERROR = /(?:HTTP|responded with) (?:408|425|429|5\d\d)\b|failed to fetch|networkerror|load failed/i;

function interleaveModelLoadJobs(jobGroups) {
    const longestGroup = Math.max(...jobGroups.map(group => group.length));
    return Array.from({ length: longestGroup }, (_, index) =>
        jobGroups.flatMap(group => group[index] === undefined ? [] : [group[index]])
    ).flat();
}

const MODEL_LOAD_JOBS = interleaveModelLoadJobs([
    createUFOCreatureModelLoadJobs(),
    createExtraCreatureModelLoadJobs(),
    createGLTFCreatureModelLoadJobs(),
    createFBXCreatureModelLoadJobs()
]);

export const CREATURE_MODEL_COUNT = MODEL_LOAD_JOBS.length;

function normalizeError(error) {
    return error instanceof Error ? error : new Error(String(error));
}

function wait(delayMilliseconds) {
    return new Promise(resolve => setTimeout(resolve, delayMilliseconds));
}

async function loadModelJobWithRetry(job, onRetry) {
    let lastError = new Error(`${job.label}: model loading did not start`);
    for (let attempt = 1; attempt <= MAX_MODEL_LOAD_ATTEMPTS; attempt++) {
        try {
            return await job.load();
        } catch (error) {
            lastError = normalizeError(error);
            const canRetry = attempt < MAX_MODEL_LOAD_ATTEMPTS && TRANSIENT_LOAD_ERROR.test(lastError.message);
            if (canRetry) {
                const retryDelay = RETRY_BASE_DELAY_MS * (2 ** (attempt - 1));
                onRetry({
                    attempt,
                    nextAttempt: attempt + 1,
                    maxAttempts: MAX_MODEL_LOAD_ATTEMPTS,
                    retryDelay,
                    error: lastError.message
                });
                await wait(retryDelay);
            } else {
                const attemptWord = attempt === 1 ? 'attempt' : 'attempts';
                throw new Error(`${job.label}: loading failed after ${attempt} ${attemptWord}: ${lastError.message}`);
            }
        }
    }
    throw new Error(`${job.label}: loading exhausted its retry loop: ${lastError.message}`);
}

export async function loadCreatureModels({ onModelLoaded = () => {}, onProgress = () => {} } = {}) {
    const failures = [];
    let nextJobIndex = 0;
    let completed = 0;
    let loaded = 0;

    const createProgress = (state, label, details = {}) => ({
        state,
        label,
        completed,
        loaded,
        failed: failures.length,
        total: CREATURE_MODEL_COUNT,
        ...details
    });

    async function loadNextJobs() {
        while (nextJobIndex < MODEL_LOAD_JOBS.length) {
            const job = MODEL_LOAD_JOBS[nextJobIndex];
            nextJobIndex++;
            onProgress(createProgress('loading', job.label));
            try {
                const model = await loadModelJobWithRetry(job, retry => {
                    onProgress(createProgress('retrying', job.label, retry));
                });
                onModelLoaded(model);
                loaded++;
                completed++;
                onProgress(createProgress('loaded', job.label));
            } catch (error) {
                const failure = { id: job.id, label: job.label, error: normalizeError(error).message };
                failures.push(failure);
                completed++;
                onProgress(createProgress('failed', job.label, { error: failure.error }));
            }
            await wait(0);
        }
    }

    const workerCount = Math.min(MAX_CONCURRENT_MODEL_LOADS, MODEL_LOAD_JOBS.length);
    await Promise.all(Array.from({ length: workerCount }, () => loadNextJobs()));
    return { loaded, failed: failures.length, total: CREATURE_MODEL_COUNT, failures };
}
