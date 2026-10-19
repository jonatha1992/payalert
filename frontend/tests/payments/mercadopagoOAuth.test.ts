import { describe, expect, it, vi } from "vitest";
import {
  authorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  verifyOAuthState,
  createOAuthState,
  MP_TOKEN_URL,
} from "@/lib/payments/connectors/mercadopagoOAuth";
const config = {
  clientId: "client",
  clientSecret: "secret",
  redirectUri: "https://payalert.test/api/integrations/mercadopago",
};
const tokens = {
  access_token: "access",
  refresh_token: "refresh",
  expires_in: 3600,
  user_id: 123,
};
describe("Mercado Pago OAuth", () => {
  it("validates state signature, expiry, tenant and user binding", () => {
    const secret = "x".repeat(40);
    const state = createOAuthState(
      { tenantId: "tenant", userId: "owner", nonce: "n", issuedAt: 1000 },
      secret,
    );
    expect(
      verifyOAuthState(
        state,
        { tenantId: "tenant", userId: "owner" },
        1001000,
        secret,
      ).nonce,
    ).toBe("n");
    expect(() =>
      verifyOAuthState(
        state + "x",
        { tenantId: "tenant", userId: "owner" },
        1001000,
        secret,
      ),
    ).toThrow();
    expect(() =>
      verifyOAuthState(
        state,
        { tenantId: "other", userId: "owner" },
        1001000,
        secret,
      ),
    ).toThrow();
    expect(() =>
      verifyOAuthState(
        state,
        { tenantId: "tenant", userId: "owner" },
        1700000,
        secret,
      ),
    ).toThrow();
  });
  it("builds documented auth URL and exchanges authorization code via mocked provider", async () => {
    const url = new URL(authorizationUrl(config, "state"));
    expect(url.origin + url.pathname).toBe(
      "https://auth.mercadopago.com.ar/authorization",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("scope")).toBe("offline_access read write");
    const call = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(tokens), { status: 200 }));
    await expect(
      exchangeAuthorizationCode("code", config, call),
    ).resolves.toMatchObject(tokens);
    expect(call).toHaveBeenCalledWith(
      MP_TOKEN_URL,
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("refreshes tokens and returns sanitized provider failures", async () => {
    const ok = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(tokens), { status: 200 }));
    await expect(
      refreshAccessToken("refresh", config, ok),
    ).resolves.toMatchObject(tokens);
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("secret denied", { status: 401 }));
    await expect(refreshAccessToken("refresh", config, failed)).rejects.toThrow(
      "Mercado Pago OAuth request failed (401)",
    );
  });
});
