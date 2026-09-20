import { ScrollViewStyleReset } from 'expo-router/html';

import { gtmNoscriptUrl, parseGtmWebId } from '@/lib/gtmWeb';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
//
// Expo `web.output: "single"` (current Vercel SPA) does not emit this file
// into dist HTML. GTM still injects at runtime via `ensureGtmWebLoaded`.
// Keep the snippet here so non-SPA / static export modes stay aligned.

const gtmWebId = parseGtmWebId(process.env.EXPO_PUBLIC_GTM_WEB) ?? '';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        {/* Letterbox + full-viewport root: web-only (+html never ships in native builds). */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {gtmWebId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmWebId}');`,
            }}
          />
        ) : null}
      </head>
      <body>
        {gtmWebId ? (
          <noscript>
            <iframe
              src={gtmNoscriptUrl(gtmWebId)}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
              title="Google Tag Manager"
            />
          </noscript>
        ) : null}
        {children}
      </body>
    </html>
  );
}

const responsiveBackground = `
html, body {
  height: 100%;
  margin: 0;
  overflow: hidden;
}
body {
  /* Letterbox around the web-only phone frame (see WebPhoneFrame.web.tsx). */
  background-color: #111111;
}
body > div {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
}
#web-phone-stage {
  flex: 1;
  width: 100%;
  height: 100%;
}
#web-phone-frame {
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}`;
