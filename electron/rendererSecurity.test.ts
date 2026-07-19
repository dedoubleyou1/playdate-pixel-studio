import { describe, expect, it } from "vitest";
import {
  isTrustedRendererNavigation,
  rendererContentSecurityPolicy,
  resolveRendererTarget,
  withContentSecurityPolicy,
} from "./rendererSecurity";

describe("Electron renderer security", () => {
  it("ignores the configured development URL in packaged builds", () => {
    const target = resolveRendererTarget({
      configuredRendererUrl: "https://attacker.example/",
      isPackaged: true,
      packagedRendererUrl: "file:///Applications/Pixel%20Studio/dist/index.html",
    });

    expect(target).toEqual({
      kind: "production",
      url: "file:///Applications/Pixel%20Studio/dist/index.html",
    });
  });

  it("accepts only HTTP development renderer URLs", () => {
    expect(
      resolveRendererTarget({
        configuredRendererUrl: "http://127.0.0.1:5173",
        isPackaged: false,
        packagedRendererUrl: "file:///app/dist/index.html",
      }),
    ).toEqual({ kind: "development", url: "http://127.0.0.1:5173/" });

    expect(() =>
      resolveRendererTarget({
        configuredRendererUrl: "file:///tmp/untrusted.html",
        isPackaged: false,
        packagedRendererUrl: "file:///app/dist/index.html",
      }),
    ).toThrow(/must use http or https/);
  });

  it("allows only the trusted dev origin or packaged renderer file", () => {
    const development = { kind: "development", url: "http://127.0.0.1:5173/" } as const;
    expect(isTrustedRendererNavigation("http://127.0.0.1:5173/settings?tab=grid", development)).toBe(true);
    expect(isTrustedRendererNavigation("https://example.com/", development)).toBe(false);

    const production = { kind: "production", url: "file:///app/dist/index.html" } as const;
    expect(isTrustedRendererNavigation("file:///app/dist/index.html#canvas", production)).toBe(true);
    expect(isTrustedRendererNavigation("file:///app/dist/other.html", production)).toBe(false);
    expect(isTrustedRendererNavigation("about:blank", production)).toBe(false);
  });

  it("uses an HMR-capable development CSP and a strict production CSP", () => {
    const development = rendererContentSecurityPolicy({
      kind: "development",
      url: "http://127.0.0.1:5173/",
    });
    const production = rendererContentSecurityPolicy({ kind: "production", url: "file:///app/dist/index.html" });

    expect(development).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(development).toContain("connect-src 'self' ws://127.0.0.1:5173");
    expect(production).toContain("script-src 'self'");
    expect(production).not.toContain("'unsafe-eval'");
    expect(production).not.toContain("ws:");
    expect(production).toContain("frame-src 'none'");
    expect(production).toContain("object-src 'none'");
  });

  it("replaces any existing CSP response header without dropping other headers", () => {
    expect(
      withContentSecurityPolicy(
        {
          "content-security-policy": ["default-src *"],
          "X-Content-Type-Options": ["nosniff"],
        },
        "default-src 'self'",
      ),
    ).toEqual({
      "Content-Security-Policy": ["default-src 'self'"],
      "X-Content-Type-Options": ["nosniff"],
    });
  });
});
