import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/server/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/session")>()),
  getSessionProfile: vi.fn(async () => null),
}));

import { GET } from "@/app/api/integrations/mercadopago/route";

describe("Mercado Pago OAuth return", () => {
  it("trata GET con code y state como retorno, no como inicio nuevo", async () => {
    const res = await GET(new NextRequest("https://app.test/api/integrations/mercadopago?code=TG-1&state=abc"));
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("si Mercado Pago devuelve error, vuelve a Integraciones sin reiniciar", async () => {
    const res = await GET(new NextRequest("https://app.test/api/integrations/mercadopago?error=access_denied"));
    expect(res.headers.get("location")).toContain("/dashboard/integrations?oauth=failed");
  });
});
