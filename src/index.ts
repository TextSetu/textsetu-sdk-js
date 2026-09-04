/**
 * Official TypeScript SDK for the TextSetu API.
 *
 * The operation functions in `./generated` are produced from the server's
 * OpenAPI spec — do not edit them. This module is the only hand-written part:
 * it configures the client, unwraps the response envelope, and turns API errors
 * into a typed exception.
 *
 * @example
 * ```ts
 * import { TextSetu } from "@textsetu/sdk";
 *
 * const ts = new TextSetu({ token: process.env.TEXTSETU_TOKEN! });
 * const { keys, total } = await ts.listKeys({ projectId, search: "checkout" });
 * ```
 */
import { client } from "./generated/client.gen.js";
import * as operations from "./generated/sdk.gen.js";

export * from "./generated/types.gen.js";

/** Production API. Override for self-hosted deployments. */
export const DEFAULT_BASE_URL = "https://api.textsetu.com/api/v1";

export interface TextSetuOptions {
  /**
   * API token — a personal access token (`tsu_pat_…`) or a project token
   * (`tsu_proj_…`). Project tokens are bound to one project and gated by
   * scopes; PATs act as their owner across every project they can reach.
   */
  token: string;
  /** Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Custom fetch, e.g. for tests or a proxy agent. */
  fetch?: typeof globalThis.fetch;
}

/**
 * An error returned by the API.
 *
 * Failures come back as `{success: false, error: {code, message}}`; `code` is a
 * stable machine-readable identifier (e.g. `PERM_001`) and is what you should
 * branch on — `message` is human-facing and may be reworded.
 */
export class TextSetuApiError extends Error {
  constructor(
    /** Stable error code, e.g. `VAL_001` / `PERM_001` / `RES_001`. */
    public readonly code: string,
    message: string,
    /** HTTP status, when one was received. */
    public readonly status?: number
  ) {
    super(message);
    this.name = "TextSetuApiError";
  }
}

/** Shape of a failed response body. */
interface ErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Unwrap `{success: true, data}` → `data`, or throw.
 *
 * Every endpoint except the raw CDN delivery route returns that envelope, so
 * callers should never have to reach through `.data` themselves.
 */
function unwrap<T>(result: {
  data?: { data?: T } | T;
  error?: unknown;
  response?: Response;
}): T {
  const status = result.response?.status;

  if (result.error !== undefined && result.error !== null) {
    const body = result.error as ErrorBody;
    throw new TextSetuApiError(
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? `Request failed${status ? ` with ${status}` : ""}`,
      status
    );
  }

  const payload = result.data;
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  // Non-enveloped responses (raw CDN delivery) pass through unchanged.
  return payload as T;
}

/** Every generated operation, as `(options) => Promise<result>`. */
type Operations = typeof operations;

/** The public client: one method per API operation, envelope already removed. */
export type TextSetuClient = {
  [K in keyof Operations]: Operations[K] extends (
    options: infer O
  ) => Promise<infer R>
    ? (
        options?: O extends { [k: string]: unknown }
          ? Omit<O, "client" | "throwOnError">
          : O
      ) => Promise<
        R extends { data?: infer D } ? UnwrapEnvelope<NonNullable<D>> : unknown
      >
    : never;
};

/**
 * Strip the `{success, data}` envelope, and the optionality with it.
 *
 * The generated result types mark `data` optional because a request may fail —
 * but this client THROWS on failure, so a returned value always has a payload.
 * Propagating `| undefined` would force consumers into `res?.keys?.[0]` noise
 * for a value that is always present.
 */
type UnwrapEnvelope<D> = D extends { data: infer Inner }
  ? NonNullable<Inner>
  : D;

class TextSetuBase {
  /** The underlying generated client, for advanced use (interceptors, etc.). */
  readonly raw = client;

  constructor(options: TextSetuOptions) {
    if (!options.token) {
      throw new Error("TextSetu: a `token` is required.");
    }
    client.setConfig({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      headers: { Authorization: `Bearer ${options.token}` },
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });

    // Bind every generated operation, unwrapping its envelope.
    for (const [name, fn] of Object.entries(operations)) {
      if (typeof fn !== "function") continue;
      Object.defineProperty(this, name, {
        value: async (opts: Record<string, unknown> = {}) =>
          unwrap(
            await (fn as (o: unknown) => Promise<never>)({ ...opts, client })
          ),
        enumerable: false,
        writable: false,
      });
    }
  }
}

/**
 * TextSetu API client — one method per API operation, with the response
 * envelope removed and failures raised as {@link TextSetuApiError}.
 */
export type TextSetu = TextSetuBase & TextSetuClient;

/**
 * The operation methods are attached in the constructor rather than declared,
 * so the constructor's public type is asserted here.
 *
 * The obvious alternative — merging `class TextSetu` with
 * `interface TextSetu extends TextSetuClient` — is genuinely unsafe and
 * eslint flags it: the interface would silently keep promising methods even if
 * the constructor stopped attaching them. Confining the assertion to this one
 * line keeps the unchecked step visible.
 */
export const TextSetu = TextSetuBase as new (
  options: TextSetuOptions
) => TextSetu;
