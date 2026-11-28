interface AssetsBinding {
  fetch: (input: Request | URL | string) => Promise<Response>;
}

interface PagesFunctionContext {
  request: Request;
  env?: {
    ASSETS?: AssetsBinding;
  };
  next: () => Promise<Response>;
}

const ALLOWED_STATIC_FILES = new Set([
  '/toolkit/manifest.json',
  '/toolkit/favicon.svg',
  '/toolkit/apple-touch-icon.png',
  '/toolkit/icon-192.png',
  '/toolkit/icon-512.png',
  '/toolkit/index.html',
]);

function notFoundResponse(reason: string): Response {
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404 Not Found</title>
    <style>
      body {
        margin: 0;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        background: #f5f5f4;
        color: #1c1917;
        font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      }
      main {
        text-align: center;
        padding: 2rem;
        background: #ffffff;
        border: 1px solid #e7e5e4;
        border-radius: 1.5rem;
        max-width: 24rem;
      }
      h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
      p { margin: 0; font-size: 0.875rem; color: #57534e; }
    </style>
  </head>
  <body>
    <main>
      <h1>404 Not Found</h1>
      <p>요청하신 페이지를 찾을 수 없습니다.</p>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-404-Reason': reason,
    },
  });
}

export const onRequest = async (context: PagesFunctionContext): Promise<Response> => {
  const rawProxyHost = context.request.headers.get('X-Proxy-Host');
  const proxyHost = rawProxyHost?.trim().toLowerCase();

  if (proxyHost !== 'facilitation.group') {
    return notFoundResponse('invalid-proxy-host');
  }

  const { pathname } = new URL(context.request.url);

  if (pathname === '/toolkit/allvoices' || pathname === '/toolkit/allvoices/') {
    if (context.env?.ASSETS) {
      const entryUrl = new URL('/toolkit/', context.request.url);
      const assetRes = await context.env.ASSETS.fetch(
        new Request(entryUrl.toString(), { method: 'GET', redirect: 'follow' })
      );
      if (assetRes.ok) {
        const html = await assetRes.text();
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      }
    }
    return context.next();
  }

  if (pathname.startsWith('/toolkit/assets/') || ALLOWED_STATIC_FILES.has(pathname)) {
    return context.next();
  }

  return notFoundResponse('unregistered-path');
};
