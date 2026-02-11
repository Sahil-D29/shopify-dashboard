import type { JourneyExecutionLog, TestUser } from '@/lib/types/test-mode';

export const testUserStore = new Map<string, TestUser[]>();
export const executionLogStore = new Map<string, JourneyExecutionLog[]>();


