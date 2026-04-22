type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ src, alt, size = "md", className = "" }: AvatarProps) {
  const sizeClass = sizeClasses[size];

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={["rounded-full object-cover", sizeClass, className].join(" ")}
      />
    );
  }

  return (
    <div
      aria-label={alt}
      className={[
        "flex items-center justify-center rounded-full bg-cornell-navy font-semibold text-white",
        sizeClass,
        className,
      ].join(" ")}
    >
      {getInitials(alt)}
    </div>
  );
}
