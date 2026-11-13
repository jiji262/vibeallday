import type { ReactNode, SVGProps } from "react";

/**
 * Garden line icons: 24px grid, 1.75 stroke, round caps, currentColor. They
 * are decorative by default; pass `title` when an icon carries meaning alone.
 */
export interface IconProps
  extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  /** Rendered width and height in px. */
  size?: number;
  title?: string;
}

const DEFAULT_ICON_SIZE = 16;

const SVG_ATTRIBUTES = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.75",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  focusable: "false",
} as const;

function createIcon(displayName: string, paths: ReactNode) {
  function Icon({ size = DEFAULT_ICON_SIZE, title, ...rest }: IconProps) {
    if (title) {
      return (
        <svg
          width={size}
          height={size}
          role="img"
          {...SVG_ATTRIBUTES}
          {...rest}
        >
          <title>{title}</title>
          {paths}
        </svg>
      );
    }
    return (
      <svg
        width={size}
        height={size}
        aria-hidden="true"
        {...SVG_ATTRIBUTES}
        {...rest}
      >
        {paths}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

export const SearchIcon = createIcon(
  "SearchIcon",
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const CopyIcon = createIcon(
  "CopyIcon",
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </>,
);

export const CheckIcon = createIcon("CheckIcon", <path d="M20 6 9 17l-5-5" />);

export const ChevronDownIcon = createIcon(
  "ChevronDownIcon",
  <path d="m6 9 6 6 6-6" />,
);

export const ChevronRightIcon = createIcon(
  "ChevronRightIcon",
  <path d="m9 6 6 6-6 6" />,
);

export const ChevronLeftIcon = createIcon(
  "ChevronLeftIcon",
  <path d="m15 6-6 6 6 6" />,
);

export const ChevronsUpDownIcon = createIcon(
  "ChevronsUpDownIcon",
  <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />,
);

export const PlusIcon = createIcon("PlusIcon", <path d="M12 5v14M5 12h14" />);

export const XIcon = createIcon("XIcon", <path d="M18 6 6 18M6 6l12 12" />);

export const RefreshIcon = createIcon(
  "RefreshIcon",
  <>
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
    <path d="M3 21v-5h5" />
  </>,
);

export const MoreHorizontalIcon = createIcon(
  "MoreHorizontalIcon",
  <>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </>,
);

export const ExternalIcon = createIcon(
  "ExternalIcon",
  <>
    <path d="M15 3h6v6M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>,
);

export const FilterIcon = createIcon(
  "FilterIcon",
  <path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />,
);

export const GlobeIcon = createIcon(
  "GlobeIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </>,
);

export const GitBranchIcon = createIcon(
  "GitBranchIcon",
  <>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M6 8.5v7M18 8.5a6 6 0 0 1-6 6H8.5" />
  </>,
);

export const DiffIcon = createIcon(
  "DiffIcon",
  <>
    <path d="M12 3v8M8 7h8M8 17h8" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </>,
);

export const AlertIcon = createIcon(
  "AlertIcon",
  <>
    <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" />
    <path d="M12 9v4M12 17h.01" />
  </>,
);

export const InfoIcon = createIcon(
  "InfoIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </>,
);

export const PanelLeftIcon = createIcon(
  "PanelLeftIcon",
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </>,
);

export const CommandIcon = createIcon(
  "CommandIcon",
  <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />,
);

export const StarIcon = createIcon(
  "StarIcon",
  <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />,
);

export const FolderIcon = createIcon(
  "FolderIcon",
  <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />,
);

export const FileIcon = createIcon(
  "FileIcon",
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </>,
);

export const ClockIcon = createIcon(
  "ClockIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);

export const ArrowUpIcon = createIcon(
  "ArrowUpIcon",
  <path d="M12 19V5M5 12l7-7 7 7" />,
);

export const CommentIcon = createIcon(
  "CommentIcon",
  <path d="M4 5h16v11H9l-5 4z" />,
);

export const TerminalIcon = createIcon(
  "TerminalIcon",
  <>
    <path d="m5 8 4 4-4 4M12 16h7" />
    <rect x="2" y="3" width="20" height="18" rx="2" />
  </>,
);

export const CpuIcon = createIcon(
  "CpuIcon",
  <>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <path d="M9.5 9.5h5v5h-5zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
  </>,
);

export const SmartphoneIcon = createIcon(
  "SmartphoneIcon",
  <>
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M11 18h2" />
  </>,
);

export const SettingsIcon = createIcon(
  "SettingsIcon",
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1" />
  </>,
);

export const InboxIcon = createIcon(
  "InboxIcon",
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1" />
  </>,
);

export const ListIcon = createIcon(
  "ListIcon",
  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
);

export const BugIcon = createIcon(
  "BugIcon",
  <>
    <rect x="7" y="8" width="10" height="13" rx="5" />
    <path d="M9 4.5 10.5 6M15 4.5 13.5 6M12 13v8M3 13h4M17 13h4M4 7l3 2M20 7l-3 2M4 20l3-2.5M20 20l-3-2.5" />
  </>,
);

export const LogOutIcon = createIcon(
  "LogOutIcon",
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
);

export const SwitchHostIcon = createIcon(
  "SwitchHostIcon",
  <path d="m17 3 4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" />,
);

/** Aliases named for the destinations that use them. */
export const OverviewIcon = InboxIcon;
export const SessionsIcon = ListIcon;
export const IssueIcon = BugIcon;
