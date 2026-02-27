'use client';

/**
 * WindowIndicator — shows the status of Meta's 24hr free messaging window.
 *
 * 🟢 "Free text available" (customer messaged within 24hr)
 * 🟡 "Window closing soon" (< 4hr remaining)
 * 🔴 "Template required" (outside 24hr window)
 */

interface WindowIndicatorProps {
  /** When the window expires (null = no window) */
  windowExpiresAt?: Date | string | null;
  /** Compact mode for table cells */
  compact?: boolean;
  /** Show time remaining */
  showTimeRemaining?: boolean;
}

export default function WindowIndicator({
  windowExpiresAt,
  compact = false,
  showTimeRemaining = true,
}: WindowIndicatorProps) {
  const expiresAt = windowExpiresAt
    ? (typeof windowExpiresAt === 'string' ? new Date(windowExpiresAt) : windowExpiresAt)
    : null;

  const now = Date.now();
  const isInWindow = expiresAt ? expiresAt.getTime() > now : false;
  const timeRemainingMs = expiresAt ? expiresAt.getTime() - now : 0;
  const hoursRemaining = timeRemainingMs / (1000 * 60 * 60);
  const isClosingSoon = isInWindow && hoursRemaining < 4;

  const getStatus = () => {
    if (!expiresAt) return { color: '#E8685A', bg: '#FFF5F5', label: 'No window', emoji: '🔴', detail: 'Template required' };
    if (!isInWindow) return { color: '#E8685A', bg: '#FFF5F5', label: 'Expired', emoji: '🔴', detail: 'Template required' };
    if (isClosingSoon) return { color: '#FF9800', bg: '#FFF8E1', label: 'Closing soon', emoji: '🟡', detail: formatTimeRemaining(timeRemainingMs) };
    return { color: '#4CAF50', bg: '#F0FFF4', label: 'Free text', emoji: '🟢', detail: formatTimeRemaining(timeRemainingMs) };
  };

  const status = getStatus();

  if (compact) {
    return (
      <span
        title={`${status.label} — ${status.detail}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '10px',
          background: status.bg,
          fontSize: '11px',
          fontWeight: 500,
          color: status.color,
          whiteSpace: 'nowrap',
        }}
      >
        <span>{status.emoji}</span>
        <span>{status.label}</span>
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: status.bg,
        border: `1px solid ${status.color}20`,
      }}
    >
      <span style={{ fontSize: '16px' }}>{status.emoji}</span>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: status.color }}>
          {status.label}
        </div>
        {showTimeRemaining && (
          <div style={{ fontSize: '10px', color: '#8B7F76' }}>
            {status.detail}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Window expired';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

/**
 * Aggregate window stats badge for campaign-level display.
 */
export function WindowStatsBadge({
  inWindow,
  total,
}: {
  inWindow: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((inWindow / total) * 100) : 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '8px',
      background: '#F0FFF4',
      border: '1px solid #C6F6D5',
    }}>
      <span style={{ fontSize: '14px' }}>🟢</span>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#4A4139' }}>
          {inWindow.toLocaleString()} of {total.toLocaleString()} in free window ({percentage}%)
        </div>
        <div style={{ fontSize: '10px', color: '#8B7F76' }}>
          Free-form text available · No template cost
        </div>
      </div>
    </div>
  );
}
