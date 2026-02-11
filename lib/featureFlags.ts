const normalizeFlagValue = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const unifiedTriggerFlag = process.env.NEXT_PUBLIC_USE_UNIFIED_TRIGGER ?? process.env.USE_UNIFIED_TRIGGER;
const triggerV2Flag =
  process.env.NEXT_PUBLIC_JOURNEY_TRIGGER_V2 ?? process.env.JOURNEY_TRIGGER_V2;

export const USE_UNIFIED_TRIGGER =
  unifiedTriggerFlag === undefined ? true : normalizeFlagValue(unifiedTriggerFlag);
export const JOURNEY_TRIGGER_V2 =
  triggerV2Flag === undefined ? false : normalizeFlagValue(triggerV2Flag);

export const isUnifiedTriggerEnabled = (): boolean => USE_UNIFIED_TRIGGER;
export const isJourneyTriggerV2Enabled = (): boolean => JOURNEY_TRIGGER_V2;

