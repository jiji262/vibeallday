import type { KeyboardEvent, MouseEvent } from "react";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { toBrowserAppHref } from "../lib/appHref";
import { PanelLeftIcon } from "./garden/icons";

const TOGGLE_ICON_SIZE = 18;

interface SidebarLauncherProps {
  label: string;
  newSessionLabel: string;
  onActivate: () => void;
  /** Extra class for callers that need to place the control in their own row */
  className?: string;
}

export function SidebarToggleIcon() {
  return <PanelLeftIcon size={TOGGLE_ICON_SIZE} />;
}

export function SidebarLauncher({
  label,
  newSessionLabel,
  onActivate,
  className,
}: SidebarLauncherProps) {
  const basePath = useRemoteBasePath();
  const newSessionHref = toBrowserAppHref(
    `${basePath}/new-session?sidebar=expanded`,
  );

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onActivate();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== " ") {
      return;
    }
    event.preventDefault();
    onActivate();
  };

  return (
    <a
      className={className ? `sidebar-toggle ${className}` : "sidebar-toggle"}
      href={newSessionHref}
      target="_blank"
      rel="noopener"
      role="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={`${label} / [Shift] ${newSessionLabel}`}
      aria-label={label}
    >
      <SidebarToggleIcon />
    </a>
  );
}
