import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

//add meta tag
export const metadata: Metadata = {
  title: "SeloraX - Create Beautiful Landing Pages",
  description:
    "SeloraX is a platform that helps you create beautiful landing pages for your products.",
  icons: {
    icon: "https://assets.selorax.io/Frame%205_KMGhi87f.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&family=Lato:wght@400;700;900&family=Libre+Baskerville:wght@400;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;700;900&family=Nunito:wght@400;500;700;900&family=Open+Sans:wght@400;500;600;700;800&family=Oswald:wght@400;500;700&family=Pacifico&family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800;900&family=PT+Serif:wght@400;700&family=Quicksand:wght@400;500;600;700&family=Raleway:wght@400;500;600;700;800;900&family=Roboto:wght@400;500;700;900&family=Roboto+Mono:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700;800;900&family=Ubuntu:wght@400;500;700&family=Work+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com"></script>
        {/*
          Import map for remote ESM components loaded via dynamic import().
          - Bare "react" / "react-dom" specifiers resolve to React 19 on esm.sh
          - Full versioned URLs for react@18.x are redirected to react@19 so that
            any already-uploaded components that imported the old version get
            the correct $$typeof symbol and don't trigger the
            "React Element from an older version" reconciler error.
          NOTE: hook-using components still need module federation for true
          instance sharing. Simple createElement-style components work fine here.
        */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              imports: {
                "react": "https://esm.sh/react@19.2.0",
                "react/jsx-runtime": "https://esm.sh/react@19.2.0/jsx-runtime",
                "react/jsx-dev-runtime": "https://esm.sh/react@19.2.0/jsx-dev-runtime",
                "react-dom": "https://esm.sh/react-dom@19.2.0",
                "react-dom/client": "https://esm.sh/react-dom@19.2.0/client",
                // Redirect any component that was uploaded with a hardcoded react@18 URL
                "https://esm.sh/react@18.3.1": "https://esm.sh/react@19.2.0",
                "https://esm.sh/react@18.3.1/jsx-runtime": "https://esm.sh/react@19.2.0/jsx-runtime",
                "https://esm.sh/react-dom@18.3.1": "https://esm.sh/react-dom@19.2.0",
              },
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
