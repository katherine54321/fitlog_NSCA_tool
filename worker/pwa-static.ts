interface Env {
  ASSETS: Fetcher;
}

const hasFileExtension = (pathname: string) => /\/[^/]+\.[a-z0-9]+$/i.test(pathname);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const url = new URL(request.url);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (request.method === "GET" && acceptsHtml && !hasFileExtension(url.pathname)) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }

    return response;
  }
};
