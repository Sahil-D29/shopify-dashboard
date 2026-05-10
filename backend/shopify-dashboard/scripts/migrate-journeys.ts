import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { JourneyConfig, JourneyDefinition, JourneyStats } from '@/lib/types/journey';

const defaultConfig: JourneyConfig = {
  reEntryRules: {
    allow: false,
    cooldownDays: 0,
  },
  maxEnrollments: null,
  timezone: 'UTC',
};

const defaultStats: JourneyStats = {
  totalEnrollments: 0,
  activeEnrollments: 0,
  completedEnrollments: 0,
  goalConversionRate: 0,
};

function migrateJourney(journey: JourneyDefinition): JourneyDefinition {
  const config: JourneyConfig = {
    ...defaultConfig,
    ...(journey.config || {}),
    reEntryRules: {
      ...defaultConfig.reEntryRules,
      ...(journey.config?.reEntryRules || {}),
    },
  };

  if (config.maxEnrollments !== null) {
    const numeric = Number(config.maxEnrollments);
    config.maxEnrollments = Number.isFinite(numeric) ? numeric : null;
  }

  const stats: JourneyStats = {
    ...defaultStats,
    ...(journey.stats || {}),
  };

  const createdAt = journey.createdAt ?? new Date().toISOString();
  const updatedAt = journey.updatedAt ?? createdAt;

  return {
    ...journey,
    createdAt,
    updatedAt,
    config,
    stats,
  };
}

async function migrateJourneys() {
  console.log('Starting journey migration…');
  const journeys = readJsonFile<JourneyDefinition>('journeys.json');
  const migrated = journeys.map(migrateJourney);
  writeJsonFile('journeys.json', migrated);
  console.log(`✅ Migrated ${migrated.length} journeys`);
}

migrateJourneys().catch(error => {
  console.error('Journey migration failed:', error);
  process.exitCode = 1;
});

