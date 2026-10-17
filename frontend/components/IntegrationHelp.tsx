"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

type IntegrationHelpProps = {
  provider: "mercado_pago" | "uala";
  webhookUrl: string;
};

const mercadoPagoSteps = [
  { text: "Abrí el panel de desarrolladores y elegí o creá tu aplicación.", href: "https://www.mercadopago.com.ar/developers/panel/app", link: "Abrir panel de aplicaciones" },
  { text: "En las credenciales de producción de esa aplicación, copiá la clave de acceso (Access Token). No uses credenciales de prueba.", href: "https://www.mercadopago.com.ar/developers/panel/app", link: "Ver aplicación y credenciales" },
  { text: "En la misma aplicación, entrá a Webhooks y configurá la dirección que aparece abajo. Elegí el evento Pagos.", href: "https://www.mercadopago.com.ar/developers/panel/app", link: "Abrir panel de aplicaciones" },
  { text: "En la sección Webhooks de esa aplicación, copiá la clave secreta de las notificaciones.", href: "https://www.mercadopago.com.ar/developers/panel/app", link: "Abrir configuración de Webhooks" },
];

export function IntegrationHelp({ provider, webhookUrl }: IntegrationHelpProps) {
  const [copied, setCopied] = useState(false);
  const isMercadoPago = provider === "mercado_pago";
  const copyWebhook = async () => {
    try {
      navigator.clipboard.writeText(webhookUrl).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }, () => setCopied(false));
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-label={`Guía para conectar ${isMercadoPago ? "Mercado Pago" : "Ualá Bis"}`} className="space-y-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
      <h3 className="font-semibold text-gray-900 dark:text-white">{isMercadoPago ? "Antes de conectar Mercado Pago" : "Antes de conectar Ualá Bis"}</h3>
      {isMercadoPago ? (
        <>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700 dark:text-gray-300">
            {mercadoPagoSteps.map((step) => <li key={step.text}>{step.text} <a className="font-medium text-blue-700 underline dark:text-blue-400" href={step.href} target="_blank" rel="noreferrer">{step.link}</a></li>)}
          </ol>
          <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Dirección para recibir notificaciones</p>
            <code className="block break-all text-xs text-gray-700 dark:text-gray-300">{webhookUrl}</code>
            <button type="button" onClick={() => void copyWebhook()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300" aria-live="polite"><Copy size={16} />{copied ? "Copiado" : "Copiar"}</button>
            <p className="text-xs text-gray-600 dark:text-gray-400">Elegí el evento Pagos al configurar la dirección.</p>
          </div>
        </>
      ) : (
        <>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>Pedile a Ualá Bis las credenciales de integración para tu cuenta. <a className="font-medium text-blue-700 underline dark:text-blue-400" href="https://www.uala.com.ar/uala-bis" target="_blank" rel="noreferrer">Ver información de Ualá Bis</a></li>
            <li>Copiá el usuario, el identificador de cliente y la clave secreta tal como te los compartieron.</li>
            <li>Elegí el entorno que te indicó Ualá Bis. Producción es para cobros reales; stage es para pruebas.</li>
          </ol>
          <p className="text-xs text-gray-600 dark:text-gray-400">Los nombres y el formato de las credenciales pueden variar según el acceso que te haya dado Ualá Bis. Si no encontrás estos datos, consultá con su soporte.</p>
        </>
      )}
      <p className="text-xs text-gray-600 dark:text-gray-400">No compartas estas claves con nadie ni las envíes por chat o correo.</p>
    </section>
  );
}
