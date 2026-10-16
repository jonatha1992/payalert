"use client";
import { useState } from "react";

export function MercadoPagoOAuthConnect() {
  const [connecting, setConnecting] = useState(false);
  if (process.env.NEXT_PUBLIC_MP_OAUTH_ENABLED !== "true") return null;
  const connect = () => {
    setConnecting(true);
    window.location.assign("/api/integrations/mercadopago");
  };
  return (
    <button
      type="button"
      disabled={connecting}
      onClick={connect}
      className="mt-3 w-full rounded-lg border border-blue-600 px-4 py-2 text-blue-700 disabled:opacity-50"
    >
      {connecting ? "Conectando…" : "Conectar con Mercado Pago (OAuth)"}
    </button>
  );
}
