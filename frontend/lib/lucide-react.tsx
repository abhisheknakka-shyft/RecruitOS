import * as React from "react";

export type LucideProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
};

function createIcon(
  displayName: string,
  render: (props: Required<Pick<LucideProps, "strokeWidth">>) => React.ReactNode
) {
  const Icon = React.forwardRef<SVGSVGElement, LucideProps>(function Icon(
    { size = 24, strokeWidth = 2, color = "currentColor", className, children, ...props },
    ref
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {render({ strokeWidth })}
        {children}
      </svg>
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

const lineIcon = (displayName: string, d: string) =>
  createIcon(displayName, () => <path d={d} />);

export const Upload = createIcon("Upload", () => (
  <>
    <path d="M12 16V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M4 20h16" />
  </>
));
export const LayoutDashboard = createIcon("LayoutDashboard", () => (
  <>
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="5" rx="1" />
    <rect x="13" y="10" width="8" height="11" rx="1" />
    <rect x="3" y="13" width="8" height="8" rx="1" />
  </>
));
export const FileText = createIcon("FileText", () => (
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h8" />
  </>
));
export const Loader2 = createIcon("Loader2", () => (
  <>
    <path d="M21 12a9 9 0 1 1-6.2-8.56" />
  </>
));
export const Plus = createIcon("Plus", () => (
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
));
export const Trash2 = createIcon("Trash2", () => (
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
  </>
));
export const ArrowLeft = lineIcon("ArrowLeft", "M19 12H5M12 19l-7-7 7-7");
export const Pencil = lineIcon("Pencil", "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z");
export const Copy = createIcon("Copy", () => (
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <rect x="2" y="2" width="13" height="13" rx="2" />
  </>
));
export const Star = createIcon("Star", () => (
  <path d="m12 2.5 2.9 6 6.6 1-4.8 4.7 1.2 6.5L12 17.7 6.1 20.7l1.2-6.5L2.5 9.5l6.6-1z" />
));
export const LayoutTemplate = createIcon("LayoutTemplate", () => (
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </>
));
export const Sparkles = createIcon("Sparkles", () => (
  <>
    <path d="m12 3 1.7 3.8L17 8.5l-3.3 1.7L12 14l-1.7-3.8L7 8.5l3.3-1.7z" />
    <path d="m5 15 0.9 2L8 18l-2.1 1-0.9 2-0.9-2L2 18l2.1-1z" />
    <path d="m19 14 0.6 1.3L21 16l-1.4.7L19 18l-.6-1.3L17 16l1.4-.7z" />
  </>
));
export const RefreshCw = createIcon("RefreshCw", () => (
  <>
    <path d="M3 12a9 9 0 0 1 15-6.7" />
    <path d="M21 12a9 9 0 0 1-15 6.7" />
    <path d="M18 2v4h-4" />
    <path d="M6 22v-4h4" />
  </>
));
export const GripVertical = createIcon("GripVertical", () => (
  <>
    <circle cx="9" cy="6" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="18" r="1" />
  </>
));
export const X = lineIcon("X", "M18 6 6 18M6 6l12 12");
export const CheckIcon = lineIcon("CheckIcon", "m5 12 5 5L20 7");
export const Kanban = createIcon("Kanban", () => (
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 8v4" />
    <path d="M12 8v8" />
    <path d="M17 8v2" />
  </>
));
export const BarChart3 = createIcon("BarChart3", () => (
  <>
    <path d="M3 3v18h18" />
    <rect x="7" y="11" width="3" height="6" />
    <rect x="12" y="8" width="3" height="9" />
    <rect x="17" y="5" width="3" height="12" />
  </>
));
export const Briefcase = createIcon("Briefcase", () => (
  <>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
  </>
));
export const ChevronDown = lineIcon("ChevronDown", "m6 9 6 6 6-6");
export const ChevronRight = lineIcon("ChevronRight", "m9 6 6 6-6 6");
export const Info = createIcon("Info", () => (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v6" />
    <path d="M12 7h.01" />
  </>
));
export const CheckSquare = createIcon("CheckSquare", () => (
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="m8 12 3 3 5-6" />
  </>
));
export const ClipboardList = createIcon("ClipboardList", () => (
  <>
    <rect x="5" y="4" width="14" height="18" rx="2" />
    <path d="M9 4h6" />
    <path d="M9 10h6" />
    <path d="M9 14h6" />
  </>
));
export const Phone = lineIcon("Phone", "M22 16.9v3a2 2 0 0 1-2.2 2A19 19 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.7L7.6 9.7a16 16 0 0 0 6.7 6.7l1.3-1.3a2 2 0 0 1 1.7-.6l3 .5a2 2 0 0 1 1.7 2z");
export const Gift = createIcon("Gift", () => (
  <>
    <rect x="3" y="8" width="18" height="13" rx="2" />
    <path d="M12 8v13" />
    <path d="M3 12h18" />
    <path d="M12 8s-1-5-4-5-3 3-1 4 5 1 5 1Z" />
    <path d="M12 8s1-5 4-5 3 3 1 4-5 1-5 1Z" />
  </>
));
export const XCircle = createIcon("XCircle", () => (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </>
));
export const Bell = createIcon("Bell", () => (
  <>
    <path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </>
));
export const Share2 = createIcon("Share2", () => (
  <>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.3 11 15.7 6.8" />
    <path d="M8.3 13 15.7 17.2" />
  </>
));
export const Download = createIcon("Download", () => (
  <>
    <path d="M12 3v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 21h16" />
  </>
));
export const MoreHorizontal = createIcon("MoreHorizontal", () => (
  <>
    <circle cx="6" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="18" cy="12" r="1.5" />
  </>
));
export const ArrowRightCircle = createIcon("ArrowRightCircle", () => (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8l4 4-4 4" />
    <path d="M8 12h6" />
  </>
));
