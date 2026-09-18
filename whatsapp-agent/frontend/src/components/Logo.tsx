export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#1A1B1E" />
      <path
        d="M31.5 13.5c-3-2-6.7-2.4-10-1-4.6 1.9-7.6 6.5-7.5 11.5.1 5.6 4.6 10.2 10.2 10.4 3.2.1 6.1-1.1 8.3-3.3"
        stroke="#12A9A6"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M20 17v15l7-7.5-7-7.5z" fill="#F4F4F5" />
      <path d="M33 29l3.6 6.2H29.4L33 29z" fill="#12A9A6" />
    </svg>
  );
}

export function Logo({ size = 36, withText = true, light = false }: { size?: number; withText?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      {withText && (
        <span className={`font-semibold leading-tight ${light ? "text-white" : "text-ink-800"}`} style={{ fontSize: size * 0.42 }}>
          WhatsApp <span className="text-brand-500">Lead Agent</span>
        </span>
      )}
    </span>
  );
}
