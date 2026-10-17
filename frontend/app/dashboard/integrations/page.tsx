"use client";

import { MercadoPagoOAuthConnect } from "./MercadoPagoOAuthConnect";
import { useState, useEffect } from "react";
import { CreditCard, Wallet, X, MapPin, Trash2 } from "lucide-react";
import { useFormValidation } from "@/hooks/useFormValidation";
import { FormField } from "@/components/FormField";
import { integrationCredentialSchemas } from "@/lib/validation/integrations";
import { IntegrationHelp } from "@/components/IntegrationHelp";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

type Provider = "mercado_pago" | "uala" | "mock";

interface Store {
  id: string;
  name: string;
}

interface ConnectionView {
  id: string;
  provider: Provider;
  storeId: string | null;
  storeName: string | null;
  label: string | null;
  providerAccountId: string | null;
  status: string;
  hasWebhookSecret: boolean;
  lastSyncAt: string | null;
  lastSyncSource: string | null;
  lastError: string | null;
}

interface CreateConnectionInput {
  provider: Provider;
  storeId?: string | null;
  label?: string | null;
  accessToken?: string;
  webhookSecret?: string;
  username?: string;
  clientId?: string;
  clientSecretId?: string;
  environment?: "production" | "stage";
  amountInCents?: boolean;
}

const providerNames = {
  mercado_pago: "Mercado Pago",
  uala: "Ualá Bis",
  mock: "Proveedor de prueba",
};
const inputClass =
  "w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none";

function statusClass(status: string) {
  if (status === "CONNECTED")
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (status === "DEGRADED" || status === "REAUTH_REQUIRED")
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  if (status === "ERROR")
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

export default function IntegrationsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [healthCheckId, setHealthCheckId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<
    "mercado_pago" | "uala" | null
  >(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const initialCredentials = {
    accessToken: "", webhookSecret: "", username: "", clientId: "", clientSecretId: "",
  };
  const credentialForm = useFormValidation(
    selectedProvider === "uala" ? integrationCredentialSchemas.uala : integrationCredentialSchemas.mercadoPago,
    initialCredentials,
  );


  useEffect(() => {
    if (!profile?.business_id) return;
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        const [response, storesResult] = await Promise.all([
          fetch("/api/integrations", {
            signal: controller.signal,
            cache: "no-store",
          }),
          supabase
            .from("stores")
            .select("id, name")
            .eq("business_id", profile.business_id),
        ]);
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Error al cargar integraciones");
        if (storesResult.error) throw new Error("Error al cargar sucursales");
        if (!controller.signal.aborted) {
          setConnections(data.connections);
          setStores(storesResult.data ?? []);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          toast.error(
            error instanceof Error
              ? error.message
              : "Error al cargar integraciones",
          );
      }
    };
    void fetchData();
    return () => controller.abort();
  }, [profile?.business_id]);

  const connect = async (input: CreateConnectionInput) => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al guardar integración");
      setConnections((previous) => [data.connection, ...previous]);
      setSelectedProvider(null);
      toast.success("Integración guardada exitosamente");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message.includes("credentials") || message.includes("credential") ? "Revisá que las claves estén copiadas completas y correspondan al entorno elegido." : "No pudimos guardar la integración. Revisá los datos e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event: { preventDefault(): void }) => {
    if (!selectedProvider || loading) return;
    await credentialForm.submit(event, async (normalized) => {
      const value = (field: keyof typeof normalized) => String(normalized[field] ?? "");
      const formData = new FormData(document.querySelector<HTMLFormElement>("#integration-form")!);
      const input: CreateConnectionInput = {
        provider: selectedProvider,
        label: String(formData.get("label") ?? "").trim() || null,
        storeId: String(formData.get("storeId") ?? "").trim() || null,
        ...(selectedProvider === "mercado_pago"
          ? { accessToken: value("accessToken"), webhookSecret: value("webhookSecret") }
          : {
              username: value("username"), clientId: value("clientId"), clientSecretId: value("clientSecretId"),
              environment: formData.get("environment") === "stage" ? "stage" as const : "production" as const,
              amountInCents: formData.get("amountInCents") === "on",
            }),
      };
      credentialForm.change("accessToken", "");
      credentialForm.change("webhookSecret", "");
      credentialForm.change("username", "");
      credentialForm.change("clientId", "");
      credentialForm.change("clientSecretId", "");
      await connect(input);
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta integración? Dejarás de recibir alertas."))
      return;
    try {
      const response = await fetch(
        `/api/integrations/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Error al eliminar integración");
      setConnections((previous) =>
        previous.filter((connection) => connection.id !== id),
      );
      toast.success("Integración eliminada");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al eliminar integración",
      );
    }
  };

  const checkHealth = async (id: string) => {
    setHealthCheckId(id);
    try {
      const response = await fetch(
        `/api/integrations/${encodeURIComponent(id)}/health`,
        { method: "GET", cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          "No pudimos comprobar la conexión. Inténtalo nuevamente.",
        );
      setConnections((previous) =>
        previous.map((c) =>
          c.id === id
            ? {
                ...c,
                lastSyncAt: data.lastSyncAt,
                lastError: data.detail,
                status: data.status,
              }
            : c,
        ),
      );
      if (data.ok) toast.success("Conexión verificada correctamente");
      else
        toast.error(
          "No se pudo conectar. Revisa las credenciales o inténtalo más tarde.",
        );
    } catch {
      toast.error("No pudimos comprobar la conexión. Inténtalo nuevamente.");
    } finally {
      setHealthCheckId(null);
    }
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires",
  });
  const relativeTime = (iso: string | null) => {
    if (!iso) return "sin consultas registradas";
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
    if (minutes < 1) return "hace menos de un minuto";
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `hace ${hours} h` : `hace ${Math.floor(hours / 24)} días`;
  };
  const syncNow = async (id: string) => {
    setSyncingId(id);
    try {
      const response = await fetch(`/api/integrations/${encodeURIComponent(id)}/sync`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos sincronizar la integración.");
      setConnections(previous => previous.map(connection => connection.id === id
        ? { ...connection, lastSyncAt: data.lastSyncAt, lastSyncSource: data.source } : connection));
      toast.success(`Consulta finalizada: ${data.newlyProcessed} pago${data.newlyProcessed === 1 ? " nuevo" : "s nuevos"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos sincronizar. Probá de nuevo más tarde.");
    } finally { setSyncingId(null); }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
        Integraciones
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(["mercado_pago", "uala"] as const).map((provider) => (
          <div
            key={provider}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between"
          >
            <div>
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${provider === "mercado_pago" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400"}`}
              >
                {provider === "mercado_pago" ? (
                  <Wallet size={24} />
                ) : (
                  <CreditCard size={24} />
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                {providerNames[provider]}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Conecta tu cuenta para recibir confirmaciones de pagos.
              </p>
            </div>
            <button
              disabled={loading}
              onClick={() => {
                setWebhookUrl(
                  `${window.location.origin}/api/webhooks/mercadopago`,
                );
                credentialForm.change("accessToken", "");
                credentialForm.change("webhookSecret", "");
                credentialForm.change("username", "");
                credentialForm.change("clientId", "");
                credentialForm.change("clientSecretId", "");
                setSelectedProvider(provider);
              }}
              className={`mt-6 w-full py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${provider === "mercado_pago" ? "bg-blue-600 hover:bg-blue-700" : "bg-pink-600 hover:bg-pink-700"}`}
            >
              Agregar Cuenta
            </button>
            {provider === "mercado_pago" && <MercadoPagoOAuthConnect />}
          </div>
        ))}
        {process.env.NODE_ENV !== "production" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-white">
              Proveedor de prueba
            </h3>
            <button
              disabled={loading}
              onClick={() => void connect({ provider: "mock" })}
              className="mt-3 px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50"
            >
              Conectar proveedor de prueba
            </button>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          Cuentas Conectadas
        </h2>
        {connections.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
            No tienes cuentas conectadas.
          </p>
        ) : (
          <div className="grid gap-4">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {providerNames[connection.provider]}
                    {connection.label && ` · ${connection.label}`}
                  </h4>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <MapPin size={14} className="mr-1" />
                    {connection.storeName || "Todas las Sucursales (General)"}
                  </div>
                  {connection.providerAccountId && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Cuenta: ••••{connection.providerAccountId.slice(-4)}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-1 rounded-full ${statusClass(connection.status)}`}
                    >
                      {connection.status}
                    </span>
                    {connection.hasWebhookSecret && (
                      <span className="text-gray-500 dark:text-gray-400">
                        firma configurada
                      </span>
                    )}
                    {connection.lastSyncAt && (
                      <span className="text-gray-400 dark:text-gray-500">
                        última verificación: {time(connection.lastSyncAt)}
                      </span>
                    )}
                    <span className="text-gray-400 dark:text-gray-500">
                      Última consulta: {relativeTime(connection.lastSyncAt)}{connection.lastSyncSource ? ` · ${connection.lastSyncSource}` : ""}
                    </span>
                    {connection.lastError && (
                      <span
                        className="text-amber-700 dark:text-amber-400"
                        title={`Diagnóstico: ${connection.lastError}`}
                      >
                        Diagnóstico: {connection.lastError}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    onClick={() => void syncNow(connection.id)}
                    disabled={syncingId !== null || connection.status === "DISCONNECTED" || connection.provider === "mock"}
                    className="px-3 py-2 text-xs border border-current rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    {syncingId === connection.id ? "Sincronizando..." : "Sincronizar ahora"}
                  </button>
                  <button
                    onClick={() => void checkHealth(connection.id)}
                    disabled={
                      healthCheckId !== null ||
                      connection.status === "DISCONNECTED"
                    }
                    className="px-3 py-1.5 text-xs border border-current rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    {healthCheckId === connection.id
                      ? "Comprobando..."
                      : connection.status === "REAUTH_REQUIRED"
                        ? "Reconectar"
                        : "Verificar"}
                  </button>
                  <button
                    onClick={() => void handleDelete(connection.id)}
                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    aria-label="Eliminar integración"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div role="dialog" aria-modal="true" aria-labelledby="integration-title" className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain p-5 sm:p-6 relative shadow-xl">
            <button
              disabled={loading}
              onClick={() => setSelectedProvider(null)}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            ><X size={24} /></button>
            <h2 id="integration-title" className="text-2xl font-bold mb-5 pr-8 text-gray-900 dark:text-white">Conectar {providerNames[selectedProvider]}</h2>
            {selectedProvider === "mercado_pago" && process.env.NEXT_PUBLIC_MP_OAUTH_ENABLED === "true" && <div className="mb-5"><MercadoPagoOAuthConnect /></div>}
            <IntegrationHelp provider={selectedProvider} webhookUrl={webhookUrl} />
            <details className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <summary className="cursor-pointer font-medium text-gray-900 dark:text-white">Avanzado: cargar claves a mano</summary>
              <form id="integration-form" onSubmit={(event) => void handleSave(event)} className="mt-4">
                <fieldset disabled={loading || credentialForm.submitting} className="space-y-4">
                  {selectedProvider === "mercado_pago" ? (
                    <>
                      <FormField name="accessToken" label="Clave de acceso de Mercado Pago (Access Token de producción)" type="password" required autoComplete="off" maxLength={4096} value={String(credentialForm.values.accessToken)} onChange={(value) => credentialForm.change("accessToken", value)} onBlur={() => credentialForm.blur("accessToken")} error={credentialForm.errorFor("accessToken")} />
                      <p className="-mt-3 text-xs text-gray-600 dark:text-gray-400">Copiala en las credenciales de producción de tu aplicación. Formato de ejemplo: APP_USR-•••••••• (solo ilustrativo). No la compartas con nadie.</p>
                      <FormField name="webhookSecret" label="Clave secreta de las notificaciones" type="password" autoComplete="off" maxLength={4096} value={String(credentialForm.values.webhookSecret)} onChange={(value) => credentialForm.change("webhookSecret", value)} onBlur={() => credentialForm.blur("webhookSecret")} error={credentialForm.errorFor("webhookSecret")} />
                      <p className="-mt-3 text-xs text-gray-600 dark:text-gray-400">Copiala en Webhooks, dentro de tu aplicación. Ejemplo de formato: una cadena larga de letras y números (sin valor real). No la compartas con nadie.</p>
                    </>
                  ) : (
                    <>
                      <FormField name="username" label="Usuario de Ualá Bis" required autoComplete="off" maxLength={255} value={String(credentialForm.values.username)} onChange={(value) => credentialForm.change("username", value)} onBlur={() => credentialForm.blur("username")} error={credentialForm.errorFor("username")} />
                      <p className="-mt-3 text-xs text-gray-600 dark:text-gray-400">Usá el usuario que te informó Ualá Bis; el formato puede variar según tu cuenta.</p>
                      <FormField name="clientId" label="Identificador de cliente (client_id)" required autoComplete="off" maxLength={255} value={String(credentialForm.values.clientId)} onChange={(value) => credentialForm.change("clientId", value)} onBlur={() => credentialForm.blur("clientId")} error={credentialForm.errorFor("clientId")} />
                      <p className="-mt-3 text-xs text-gray-600 dark:text-gray-400">Copialo de las credenciales de integración que te dio Ualá Bis. Ejemplo: una cadena identificadora, sin valor real.</p>
                      <FormField name="clientSecretId" label="Clave secreta de Ualá Bis (client_secret_id)" type="password" required autoComplete="off" maxLength={4096} value={String(credentialForm.values.clientSecretId)} onChange={(value) => credentialForm.change("clientSecretId", value)} onBlur={() => credentialForm.blur("clientSecretId")} error={credentialForm.errorFor("clientSecretId")} />
                      <p className="-mt-3 text-xs text-gray-600 dark:text-gray-400">Copiala de tus credenciales de integración. Ejemplo: una cadena secreta larga (sin valor real). No la compartas con nadie.</p>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entorno<select name="environment" className={`${inputClass} mt-1`} defaultValue="production"><option value="production">Producción</option><option value="stage">Pruebas (stage)</option></select></label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" name="amountInCents" />Enviar montos en centavos</label>
                    </>
                  )}
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Etiqueta (opcional)<input name="label" className={`${inputClass} mt-1`} /></label>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sucursal (opcional)<select name="storeId" className={`${inputClass} mt-1`} defaultValue=""><option value="">General (Todas)</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
                  <div className="pt-2 flex flex-col-reverse gap-3 sm:flex-row"><button type="button" onClick={() => setSelectedProvider(null)} className="flex-1 min-h-11 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200">Cancelar</button><button type="submit" className="flex-1 min-h-11 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50" disabled={loading || credentialForm.submitting || !credentialForm.isValid}>{loading ? "Guardando..." : "Guardar integración"}</button></div>
                </fieldset>
              </form>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
