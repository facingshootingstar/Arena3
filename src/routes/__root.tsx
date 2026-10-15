import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { useRetryKey } from "@/lib/connection";
import { LangProvider, t } from "@/lib/i18n";
import { ClickSpark } from "@/components/fx";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Arena3";

// Its own component so `t()` runs when the language remounts it, not once in the root render.
function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      {t("Skip to main content")}
    </a>
  );
}

// "Reload page" on the connection banner bumps this key, which remounts whatever page is showing so
// it asks for its data again. Without it a page whose first request failed keeps its grey blocks.
function RetryOutlet() {
  return <Outlet key={useRetryKey()} />;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      // The same sprout green the manifest and the palette use, so the phone chrome matches the brand.
      { name: "theme-color", content: "#3f7d20" },
      {
        name: "description",
        content:
          "Arena3: book badminton, basketball and volleyball courts, coached classes and memberships at an indoor sports centre in Ho Chi Minh City.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <LangProvider>
            <SkipLink />
            {/* Click feedback on the public pages only; it parks its rAF loop whenever there is
                nothing left to draw. */}
            <PublicClickSpark />
            <RetryOutlet />
          </LangProvider>
          {/* Below the 56px header on both sizes: sonner's phone default of 16px sat on top of it, and
              six seconds rather than four, because a refused payment is a line to read twice. */}
          <Toaster
            position="top-center"
            offset={72}
            mobileOffset={{ top: 68, left: 16, right: 16 }}
            duration={6000}
            visibleToasts={3}
            toastOptions={{
              className: "font-sans",
              style: {
                background: "var(--color-surface)",
                color: "var(--color-fg)",
                border: "1px solid var(--color-line)",
              },
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

/**
 * The working screens (member, desk, coach, manager) are tools used many times a day, and the
 * review asked for fewer effects there (X-4). The spark stays where it greets people: the
 * landing, sign-in, sign-up and the public pages.
 */
const WORK_PREFIXES = ["/app", "/desk", "/manager", "/coach", "/account", "/alerts"];
function PublicClickSpark() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (WORK_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <ClickSpark />;
}
