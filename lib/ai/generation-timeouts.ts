// Each provider stage shares one ten-minute deadline across its requests.
export const generationStageTimeoutMs = 10 * 60 * 1_000;

// Cover the route's text request, queued image generation, and response cleanup.
// Keep longer than the generation route's 960-second hosting allowance.
export const generationLeaseMs = 17 * 60 * 1_000;
