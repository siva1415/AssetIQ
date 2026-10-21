import React from 'react';
import { Laptop, Monitor } from 'lucide-react';

export interface DeviceTypeIconProps {
  type?: string | null;
  className?: string;
}

/**
 * Normalizes device type values using safe, case-insensitive comparison:
 * - Laptop, LAPTOP, laptop -> Laptop icon
 * - Desktop, DESKTOP, desktop -> Desktop icon
 * Safely handles null, undefined, empty strings, and unexpected values.
 */
export const DeviceTypeIcon: React.FC<DeviceTypeIconProps> = ({
  type,
  className = 'w-3.5 h-3.5 shrink-0',
}) => {
  const norm = (type ?? '').toString().trim().toLowerCase();

  if (norm === 'desktop') {
    return <Monitor className={`${className} text-blue-500`} />;
  }
  // Laptop icon for 'laptop' and safe fallback for null/empty/unexpected values
  return <Laptop className={`${className} text-emerald-500`} />;
};
