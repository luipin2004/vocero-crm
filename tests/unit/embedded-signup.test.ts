import { describe, expect, it } from "vitest";
import {
  isTrustedMetaOrigin,
  parseEmbeddedSignupFinish,
} from "@/lib/meta/embedded-signup";

describe("Embedded Signup", () => {
  it("acepta solamente orígenes HTTPS de Facebook", () => {
    expect(isTrustedMetaOrigin("https://www.facebook.com")).toBe(true);
    expect(isTrustedMetaOrigin("https://web.facebook.com")).toBe(true);
    expect(isTrustedMetaOrigin("http://www.facebook.com")).toBe(false);
    expect(isTrustedMetaOrigin("https://facebook.com.evil.example")).toBe(false);
    expect(isTrustedMetaOrigin("not-a-url")).toBe(false);
  });

  it("extrae WABA y Phone Number ID de un evento FINISH", () => {
    expect(
      parseEmbeddedSignupFinish(
        JSON.stringify({
          type: "WA_EMBEDDED_SIGNUP",
          event: "FINISH",
          data: { waba_id: "123", phone_number_id: "456" },
        })
      )
    ).toEqual({ wabaId: "123", phoneNumberId: "456" });
  });

  it("ignora eventos ajenos, cancelados o incompletos", () => {
    expect(
      parseEmbeddedSignupFinish({
        type: "WA_EMBEDDED_SIGNUP",
        event: "CANCEL",
        data: { waba_id: "123", phone_number_id: "456" },
      })
    ).toBeNull();
    expect(parseEmbeddedSignupFinish({ type: "otro" })).toBeNull();
    expect(parseEmbeddedSignupFinish("no-json")).toBeNull();
  });
});
