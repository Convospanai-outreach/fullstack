/**
 * Worker Neutralizer
 * The worker process has been migrated to the backend (convospan-api/workers).
 * This file is a placeholder to prevent build errors.
 */
export async function processNextJob() {
    console.warn("Worker process is only available on the backend.");
}

if (typeof process !== 'undefined' && process.env['RUN_WORKER'] === 'true') {
     console.error("Worker attempted to start in frontend. Please run via convospan-api.");
}
