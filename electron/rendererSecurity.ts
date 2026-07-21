export interface RendererTargetOptions {
  configuredRendererUrl?: string;
  isPackaged: boolean;
  packagedRendererUrl: string;
}

export interface RendererTarget {
  kind: "development" | "production";
  url: string;
}

export type RendererResponseHeaders = Record<string, string | string[]>;

export function resolveRendererTarget(options: RendererTargetOptions): RendererTarget {
  if (!options.isPackaged && options.configuredRendererUrl) {
    const url = new URL(options.configuredRendererUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("ELECTRON_RENDERER_URL must use http or https.");
    }
    return { kind: "development", url: url.href };
  }

  const packagedUrl = new URL(options.packagedRendererUrl);
  if (packagedUrl.protocol !== "file:") throw new Error("The packaged renderer must use a file URL.");
  return { kind: "production", url: packagedUrl.href };
}

export function isTrustedRendererNavigation(navigationUrl: string, target: RendererTarget): boolean {
  try {
    const navigation = new URL(navigationUrl);
    const trusted = new URL(target.url);
    if (target.kind === "development") return navigation.origin === trusted.origin;
    return (
      navigation.protocol === "file:" &&
      navigation.host === trusted.host &&
      decodeURIComponent(navigation.pathname) === decodeURIComponent(trusted.pathname)
    );
  } catch {
    return false;
  }
}

export function rendererContentSecurityPolicy(target: RendererTarget): string {
  const directives = [
    "default-src 'self'",
    target.kind === "development" ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${target.kind === "development" ? ` ${websocketOrigin(target.url)}` : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ];
  return directives.join("; ");
}

export function withContentSecurityPolicy(
  headers: RendererResponseHeaders | undefined,
  policy: string,
): RendererResponseHeaders {
  const nextHeaders = Object.fromEntries(
    Object.entries(headers ?? {}).filter(([name]) => name.toLowerCase() !== "content-security-policy"),
  );
  return { ...nextHeaders, "Content-Security-Policy": [policy] };
}

function websocketOrigin(rendererUrl: string): string {
  const url = new URL(rendererUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}
