import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { useRetryKey } from "@/lib/connection";
import { LangProvider, t } from "@/lib/i18n";
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
      // Phone chrome matches the page surface in each colour scheme.
      { name: "theme-color", content: "#f5f6f9", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#0a0f1d", media: "(prefers-color-scheme: dark)" },
      {
        name: "description",
        content:
          "Arena3: đặt sân cầu lông, bóng rổ, bóng chuyền, lớp học và gói tập tại một trung tâm thể thao trong nhà ở TP. Hồ Chí Minh.",
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
    <html lang="vi" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <LangProvider>
            <SkipLink />
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
