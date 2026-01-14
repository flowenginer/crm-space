import { useMemo, useState, useEffect } from 'react';
import { differenceInMilliseconds, addHours } from 'date-fns';

export interface Window24hStatus {
  isExpired: boolean;
  remainingHours: number;
  remainingMinutes: number;
  remainingSeconds: number;
  percentageUsed: number;
  windowEnd: Date | null;
  lastClientMessageAt: Date | null;
  isOfficialChannel: boolean;
  windowDurationHours: number; // 24 or 72 for CTWA
  isCTWA: boolean;
}

/**
 * Hook to calculate the messaging window status for official WhatsApp API channels
 * @param lastClientMessageAt - Timestamp of the last message from the client
 * @param isOfficialChannel - Whether the channel is an official Meta Cloud API channel
 * @param isCTWA - Whether this is a Click-to-WhatsApp Ad conversation (72h window)
 * @returns Window24hStatus object with expiration info and remaining time
 */
export function use24hWindow(
  lastClientMessageAt: string | null | undefined,
  isOfficialChannel: boolean,
  isCTWA: boolean = false
): Window24hStatus | null {
  const [now, setNow] = useState(new Date());

  // Window duration: 72h for CTWA, 24h for regular messages
  const windowDurationHours = isCTWA ? 72 : 24;

  // Update "now" every second for accurate countdown display
  useEffect(() => {
    if (!isOfficialChannel || !lastClientMessageAt) return;

    const intervalRef = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(intervalRef);
  }, [isOfficialChannel, lastClientMessageAt]);

  return useMemo(() => {
    if (!isOfficialChannel) return null;

    // If no client message, window is expired (can't send without template)
    if (!lastClientMessageAt) {
      return {
        isExpired: true,
        remainingHours: 0,
        remainingMinutes: 0,
        remainingSeconds: 0,
        percentageUsed: 100,
        windowEnd: null,
        lastClientMessageAt: null,
        isOfficialChannel: true,
        windowDurationHours,
        isCTWA,
      };
    }

    try {
      const lastMessage = new Date(lastClientMessageAt);
      const windowEnd = addHours(lastMessage, windowDurationHours);
      const remainingMs = differenceInMilliseconds(windowEnd, now);

      const isExpired = remainingMs <= 0;

      if (isExpired) {
        return {
          isExpired: true,
          remainingHours: 0,
          remainingMinutes: 0,
          remainingSeconds: 0,
          percentageUsed: 100,
          windowEnd,
          lastClientMessageAt: lastMessage,
          isOfficialChannel: true,
          windowDurationHours,
          isCTWA,
        };
      }

      const totalWindowMs = windowDurationHours * 60 * 60 * 1000;
      const elapsedMs = totalWindowMs - remainingMs;
      const percentageUsed = Math.min(100, (elapsedMs / totalWindowMs) * 100);

      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

      return {
        isExpired: false,
        remainingHours,
        remainingMinutes,
        remainingSeconds,
        percentageUsed,
        windowEnd,
        lastClientMessageAt: lastMessage,
        isOfficialChannel: true,
        windowDurationHours,
        isCTWA,
      };
    } catch {
      return null;
    }
  }, [lastClientMessageAt, isOfficialChannel, now, windowDurationHours, isCTWA]);
}

/**
 * Format the remaining time as a countdown timer (HH:MM:SS)
 */
export function formatRemainingTime(status: Window24hStatus | null): string {
  if (!status || !status.isOfficialChannel) return '';
  if (status.isExpired) return 'Expirada';

  const h = String(status.remainingHours).padStart(2, '0');
  const m = String(status.remainingMinutes).padStart(2, '0');
  const s = String(status.remainingSeconds).padStart(2, '0');

  return `${h}:${m}:${s}`;
}
