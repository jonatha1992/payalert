"use client";

import { MercadoPagoOAuthConnect } from "./MercadoPagoOAuthConnect";
import { useState, useEffect, type FormEvent } from "react";
import { CreditCard, Wallet, X, MapPin, Trash2 } from "lucide-react";
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
  const [stores, setStores] = useState<Store[]>([]);
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<
    "mercado_pago" | "uala" | null
  >(null);
  const [webhookUrl, setWebhookUrl] = useState("");

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
      if (!response.ok)
        throw new Error(data.error || "Error al guardar integración");
      setConnections((previous) => [data.connection, ...previous]);
      setSelectedProvider(null);
      toast.success("Integración guardada exitosamente");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar integración",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProvider || loading) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const input: CreateConnectionInput = {
      provider: selectedProvider,
      label: value("label") || null,
      storeId: value("storeId") || null,
      ...(selectedProvider === "mercado_pago"
        ? {
            accessToken: value("accessToken"),
            webhookSecret: value("webhookSecret"),
          }
        : {
            username: value("username"),
            clientId: value("clientId"),
            clientSecretId: value("clientSecretId"),
            environment:
              value("environment") === "stage"
                ? ("stage" as const)
                : ("production" as const),
            amountInCents: data.get("amountInCents") === "on",
          }),
    };
    // Clear credentials immediately, including when the request fails.
    form.reset();
    void connect(input);
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

  const time = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
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
                <div className="flex items-center gap-2">
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="integration-title"
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 relative shadow-xl"
          >
            <button
              disabled={loading}
              onClick={() => setSelectedProvider(null)}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
            <h2
              id="integration-title"
              className="text-2xl font-bold mb-6 pr-6 text-gray-900 dark:text-white"
            >
              Conectar {providerNames[selectedProvider]}
            </h2>
            <form onSubmit={handleSave}>
              <fieldset disabled={loading} className="space-y-4">
                {(selectedProvider === "mercado_pago"
                  ? [
                      {
                        name: "accessToken",
                        label: "Access Token",
                        type: "password",
                      },
                      {
                        name: "webhookSecret",
                        label: "Webhook secret signature",
                        type: "password",
                      },
                    ]
                  : [
                      { name: "username", label: "Username", type: "text" },
                      { name: "clientId", label: "client_id", type: "text" },
                      {
                        name: "clientSecretId",
                        label: "client_secret_id",
                        type: "password",
                      },
                    ]
                ).map((field) => (
                  <label
                    key={field.name}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {field.label}
                    <input
                      name={field.name}
                      type={field.type}
                      required
                      autoComplete="off"
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                ))}
                {selectedProvider === "uala" && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Entorno
                      <select
                        name="environment"
                        className={`${inputClass} mt-1`}
                        defaultValue="production"
                      >
                        <option value="production">production</option>
                        <option value="stage">stage</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" name="amountInCents" />
                      Enviar montos en centavos
                    </label>
                  </>
                )}
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Etiqueta (opcional)
                  <input name="label" className={`${inputClass} mt-1`} />
                </label>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sucursal (opcional)
                  <select
                    name="storeId"
                    className={`${inputClass} mt-1`}
                    defaultValue=""
                  >
                    <option value="">General (Todas)</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 break-words">
                  {selectedProvider === "mercado_pago" ? (
                    <>
                      Configura el webhook{" "}
                      <span className="font-mono">{webhookUrl}</span>, evento
                      &quot;Pagos&quot;. El secreto se obtiene en Tus
                      integraciones &gt; Webhooks.
                    </>
                  ) : (
                    "Las notificaciones llegan automáticamente para los cobros creados desde PayAlert."
                  )}
                </p>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "Guardando..." : "Guardar Integración"}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
