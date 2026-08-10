import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const marketApiProxy = () => ({
  name: "market-api-proxy",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? "";
      const targets: Array<{ prefix: string; origin: string }> = [
        { prefix: "/market-api/vps", origin: "https://bgapidatafeed.vps.com.vn" },
        { prefix: "/market-api/vndirect", origin: "https://finfo-api.vndirect.com.vn" },
        { prefix: "/market-api/binance", origin: "https://www.binance.com" },
      ];
      const target = targets.find((item) => url.startsWith(item.prefix));
      if (!target) {
        next();
        return;
      }

      try {
        const upstreamUrl = `${target.origin}${url.replace(target.prefix, "")}`;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const upstream = await fetch(upstreamUrl, {
          method: req.method,
          headers: {
            accept: "application/json,text/plain,*/*",
            "content-type": req.headers["content-type"] ?? "application/json",
            "user-agent": "Mozilla/5.0",
          },
          body,
        });
        const responseBody = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
        res.end(responseBody);
      } catch {
        res.statusCode = 502;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Market API proxy fetch failed" }));
      }
    });
  },
});

export default defineConfig({
  plugins: [marketApiProxy(), react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
