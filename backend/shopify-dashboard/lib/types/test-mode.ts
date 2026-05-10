export interface TestUser {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  addedAt: string;
}

export interface ValidationError {
  nodeId: string;
  nodeName: string;
  errorType: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export interface JourneyExecutionLog {
  testUserId: string;
  nodeId: string;
  nodeName: string;
  timestamp: string;
  status: 'entered' | 'completed' | 'failed' | 'skipped';
  details?: string;
}



