"use client";

import Link from "next/link";
import { useState } from "react";

interface HoverLinkProps {
  href: string;
  baseStyle: React.CSSProperties;
  hoverStyle: React.CSSProperties;
  children: React.ReactNode;
}

export function HoverLink({ href, baseStyle, hoverStyle, children }: HoverLinkProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      style={{ textDecoration: "none", ...baseStyle, ...(hovered ? hoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  );
}

interface HoverDivProps {
  baseStyle: React.CSSProperties;
  hoverStyle: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
}

export function HoverDiv({ baseStyle, hoverStyle, children, onClick }: HoverDivProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...baseStyle, ...(hovered ? hoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}