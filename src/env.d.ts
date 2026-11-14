/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
