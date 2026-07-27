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
      ];
      const target = targets.find((item) => url.startsWith(item.prefix));
      if (!target) {
        next();
        return;
      }

      try {
        const upstreamUrl = `${target.origin}${url.replace(target.prefix, "")}`;
        const upstream = await fetch(upstreamUrl, {
          headers: {
            accept: "application/json,text/plain,*/*",
            "user-agent": "Mozilla/5.0",
          },
        });
        const body = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
        res.end(body);
      } catch (error) {
        next(error);
      }
    });
  },
});

export default defineConfig({
  plugins: [marketApiProxy(), react()],
});
