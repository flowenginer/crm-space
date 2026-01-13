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
}

/**
 * Hook to calculate the 24h messaging window status for official WhatsApp API channels
 * @param lastClientMessageAt - Timestamp of the last message from the client
 * @param isOfficialChannel - Whether the channel is an official Meta Cloud API channel
 * @returns Window24hStatus object with expiration info and remaining time
 */
export function use24hWindow(
  lastClientMessageAt: string | null | undefined,
  isOfficialChannel: boolean
): Window24hStatus | null {
  const [now, setNow] = useState(new Date());

  // Update "now" dynamically - faster updates only when close to expiration
  // OPTIMIZATION: Reduce CPU usage by updating less frequently when not critical
  useEffect(() => {
    if (!isOfficialChannel || !lastClientMessageAt) return;

    // Calculate initial remaining time to determine update frequency
    const calculateInterval = () => {
      try {
        const lastMessage = new Date(lastClientMessageAt);
        const windowEnd = addHours(lastMessage, 24);
        const remainingMs = differenceInMilliseconds(windowEnd, new Date());
        const remainingMinutes = Math.floor(remainingMs / (1000 * 60));
        
        // If less than 10 minutes remaining, update every second
        if (remainingMinutes < 10) return 1000;
        // If less than 1 hour remaining, update every 10 seconds
        if (remainingMinutes < 60) return 10000;
        // Otherwise, update every 30 seconds (sufficient for display)
        return 30000;
      } catch {
        return 30000;
      }
    };

    let currentInterval = calculateInterval();
    
    const updateNow = () => {
      setNow(new Date());
      // Recalculate interval as we might need faster updates
      const newInterval = calculateInterval();
      if (newInterval !== currentInterval) {
        currentInterval = newInterval;
        clearInterval(intervalRef);
        intervalRef = setInterval(updateNow, currentInterval);
      }
    };

    let intervalRef = setInterval(updateNow, currentInterval);

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
      };
    }

    try {
      const lastMessage = new Date(lastClientMessageAt);
      const windowEnd = addHours(lastMessage, 24);
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
        };
      }

      const totalWindowMs = 24 * 60 * 60 * 1000; // 24 hours in ms
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
      };
    } catch {
      return null;
    }
  }, [lastClientMessageAt, isOfficialChannel, now]);
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
