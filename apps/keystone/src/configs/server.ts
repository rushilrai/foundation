import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

export async function setupServer() {
    try {
        const environment = process.env.NODE_ENV;
        const host = process.env.HOST;
        const port = Number(process.env.PORT);
        const backendUrl = process.env.BACKEND_URL;
        const corsWhitelist = [""];

        if (!host) {
            throw new Error("HOST must be set");
        }

        if (!backendUrl) {
            throw new Error("BACKEND_URL must be set");
        }

        if (Number.isNaN(port)) {
            throw new Error("PORT must be a valid number");
        }

        const app = Fastify({ logger: true, trustProxy: true });

        app.register(cookie);
        app.register(cors, { origin: environment === "dev" ? true : corsWhitelist, credentials: true });
        app.register(helmet);
        app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

        app.get("/health", async () => {
            return { status: "ok" };
        });

        await app.register((instance) => {
            // TODO: Add API routes here
        }, { prefix: "/api" });

        await app.ready();

        await app.listen({ port, host })

        app.log.info(`Server is running on port ${port} and host ${host}`);

        return app;
    } catch (error) {
        console.error("Server setup failed", error);

        throw error;
    }
}
