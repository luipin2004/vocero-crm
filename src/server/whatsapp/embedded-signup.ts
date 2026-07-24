import { getEnv } from "@/lib/env";
import { graphRequest, MetaApiError } from "@/lib/meta/client";
import { saveCredentials } from "@/server/whatsapp/credentials";
import { subscribeAppToWaba } from "@/server/whatsapp/connect";

type TokenExchangeResponse = {
  access_token?: string;
  token_type?: string;
};

type WabaPhoneNumbers = {
  data?: Array<{
    id?: string;
    display_phone_number?: string;
    verified_name?: string;
  }>;
};

export type EmbeddedSignupResult = {
  displayPhoneNumber: string;
  verifiedName: string | null;
};

/**
 * Intercambia el código efímero de Embedded Signup en el servidor. El App
 * Secret nunca sale hacia el navegador ni se persiste en la base de datos.
 */
async function exchangeCodeForToken(code: string): Promise<string> {
  const env = getEnv();
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    throw new Error("Embedded Signup no está configurado en la instancia");
  }

  const url = new URL(
    `${env.META_GRAPH_BASE_URL}/${env.META_GRAPH_API_VERSION}/oauth/access_token`
  );
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("client_secret", env.META_APP_SECRET);
  url.searchParams.set("code", code);

  let response: Response;
  try {
    response = await fetch(url, { method: "GET", cache: "no-store" });
  } catch {
    throw new MetaApiError("No se pudo contactar la API de Meta", { status: 0 });
  }

  const payload = (await response.json().catch(() => null)) as
    | (TokenExchangeResponse & {
        error?: { message?: string; code?: number; type?: string };
      })
    | null;
  if (!response.ok || !payload?.access_token) {
    throw new MetaApiError(
      payload?.error?.message ?? "Meta rechazó el código de autorización",
      {
        status: response.status,
        code: payload?.error?.code,
        type: payload?.error?.type,
      }
    );
  }
  return payload.access_token;
}

/** Confirma que el número autorizado pertenece realmente a la WABA recibida. */
async function verifyAuthorizedNumber(
  wabaId: string,
  phoneNumberId: string,
  token: string
): Promise<EmbeddedSignupResult> {
  const response = await graphRequest<WabaPhoneNumbers>(
    `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
    { token }
  );
  const phone = response.data?.find((item) => item.id === phoneNumberId);
  if (!phone?.display_phone_number) {
    throw new MetaApiError(
      "El número autorizado no pertenece a la cuenta de WhatsApp seleccionada",
      { status: 422 }
    );
  }
  return {
    displayPhoneNumber: phone.display_phone_number,
    verifiedName: phone.verified_name ?? null,
  };
}

export async function completeEmbeddedSignup(input: {
  organizationId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<EmbeddedSignupResult> {
  const token = await exchangeCodeForToken(input.code);
  const phone = await verifyAuthorizedNumber(
    input.wabaId,
    input.phoneNumberId,
    token
  );

  await saveCredentials({
    organizationId: input.organizationId,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    token,
    displayPhoneNumber: phone.displayPhoneNumber,
    verifiedName: phone.verifiedName,
  });
  await subscribeAppToWaba(input.wabaId, token);
  return phone;
}
