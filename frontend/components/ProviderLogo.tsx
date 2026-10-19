type ProviderLogoProps = { provider: "mercadopago" | "uala"; size?: number };

const BRANDS = {
  mercadopago: { label: "Mercado Pago", text: "MP", bg: "#009EE3" },
  uala: { label: "Ualá", text: "U", bg: "#4B3FD8" },
} as const;

export default function ProviderLogo({ provider, size = 40 }: ProviderLogoProps) {
  const brand = BRANDS[provider];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={brand.label} className="shrink-0">
      <rect width="40" height="40" rx="10" fill={brand.bg} />
      <text x="20" y="26" textAnchor="middle" fontSize={brand.text.length > 1 ? 16 : 20} fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">{brand.text}</text>
    </svg>
  );
}
