
export type JobStatus = 'pending' | 'captions' | 'downloading' | 'processing' | 'completed' | 'error';

export interface Job {
    id: string;
    status: JobStatus;
    progress: number; // 0-100
    message: string;
    result?: {
        transcript: string;
        method: 'captions' | 'whisper';
        metadata?: {
            title: string;
            channel: string;
            duration: string;
            thumbnail: string;
        };
    };
    error?: string;
    createdAt: number;
}

// Global in-memory store
// Note: In a real serverless deployment (Vercel), this variable 
// might be reset if the container is recycled. 
// For reliable serverless, use Redis (e.g., Upstash).
// For local 'npm run dev', this works perfectly.
export const jobStore = new Map<string, Job>();

export function createJob(): Job {
    const id = crypto.randomUUID();
    const job: Job = {
        id,
        status: 'pending',
        progress: 0,
        message: 'Initializing...',
        createdAt: Date.now(),
    };
    jobStore.set(id, job);
    return job;
}

export function updateJob(id: string, updates: Partial<Job>) {
    const job = jobStore.get(id);
    if (job) {
        Object.assign(job, updates);
    }
}

export function getJob(id: string) {
    return jobStore.get(id);
}
