import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { MetaApiError } from "@/lib/meta/client";
import { completeEmbeddedSignup } from "@/server/whatsapp/embedded-signup";

export const dynamic = "force-dynamic";

function publicConfiguration() {
  const env = getEnv();
  const configured = Boolean(
    env.META_APP_ID &&
      env.META_APP_SECRET &&
      env.META_EMBEDDED_SIGNUP_CONFIG_ID
  );
  return {
    configured,
    appId: configured ? env.META_APP_ID : null,
    configurationId: configured ? env.META_EMBEDDED_SIGNUP_CONFIG_ID : null,
    graphVersion: env.META_GRAPH_API_VERSION,
  };
}

export const GET = withAuth(async () => {
  return Response.json(publicConfiguration());
});

const postSchema = z.object({
  code: z.string().trim().min(1).max(4096),
  wabaId: z.string().trim().regex(/^\d+$/, "WABA ID inválido"),
  phoneNumberId: z.string().trim().regex(/^\d+$/, "Phone Number ID inválido"),
});

export const POST = withAuth(async (session, req: Request) => {
  if (!publicConfiguration().configured) {
    return apiError(
      503,
      "embedded_signup_not_configured",
      "Embedded Signup todavía no está configurado en esta instancia"
    );
  }
  const body = await parseBody(req, postSchema);
  if (!body.ok) return body.response;

  try {
    const result = await completeEmbeddedSignup({
      organizationId: session.organizationId,
      ...body.data,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof MetaApiError) {
      const status = error.status === 0 || error.status >= 500 ? 503 : 422;
      return apiError(status, "meta_signup_failed", error.message);
    }
    throw error;
  }
});
