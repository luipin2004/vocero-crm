export type EmbeddedSignupFinish = {
  wabaId: string;
  phoneNumberId: string;
};

type MetaEmbeddedSignupMessage = {
  type?: unknown;
  event?: unknown;
  data?: {
    waba_id?: unknown;
    phone_number_id?: unknown;
  };
};

/** Acepta exclusivamente mensajes del SDK oficial de Facebook. */
export function isTrustedMetaOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com"))
    );
  } catch {
    return false;
  }
}

/** Extrae el resultado FINISH del postMessage emitido por Embedded Signup. */
export function parseEmbeddedSignupFinish(
  raw: unknown
): EmbeddedSignupFinish | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") return null;
  const message = value as MetaEmbeddedSignupMessage;
  if (message.type !== "WA_EMBEDDED_SIGNUP" || message.event !== "FINISH") {
    return null;
  }

  const wabaId = message.data?.waba_id;
  const phoneNumberId = message.data?.phone_number_id;
  if (typeof wabaId !== "string" || typeof phoneNumberId !== "string") {
    return null;
  }
  if (!wabaId.trim() || !phoneNumberId.trim()) return null;
  return { wabaId: wabaId.trim(), phoneNumberId: phoneNumberId.trim() };
}
