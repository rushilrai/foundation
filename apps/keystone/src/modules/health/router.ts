import type { FastifyInstance } from "fastify";

export function buildHealthRoutes(app: FastifyInstance) {
    app.get("/health/check", async () => {
        return { status: "alive" };
    });
}