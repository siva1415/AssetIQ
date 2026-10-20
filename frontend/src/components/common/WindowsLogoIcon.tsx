import React from 'react';

export interface WindowsLogoIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * Authentic Microsoft Windows brand silhouette logo icon matching the official Windows 10 perspective tiles:
 * - Recognizable 4-pane perspective window angled with exact orthogonal cross-hair divide
 * - Standardized to a 24x24 viewBox for perfect size parity with Lucide and AppleLogoIcon (w-5 h-5)
 * - Fills with currentColor for seamless theme accent color styling
 */
export const WindowsLogoIcon: React.FC<WindowsLogoIconProps> = ({
  className = 'w-4 h-4',
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* 4 Windows 10 perspective panes divided by an orthogonal crossbar */}
      <path d="M0 3.45L9.75 2.1V11.4H0V3.45ZM10.95 1.95L24 0V11.4H10.95V1.95ZM0 12.6H9.75V21.9L0 20.55V12.6ZM10.95 12.6H24V24L10.95 22.05V12.6Z" />
    </svg>
  );
};

export default WindowsLogoIcon;
