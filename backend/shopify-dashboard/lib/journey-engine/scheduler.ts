import { processScheduledExecutions } from './executor';

export async function processScheduledJourneySteps() {
  const now = new Date().toISOString();
  return processScheduledExecutions(now);
}

