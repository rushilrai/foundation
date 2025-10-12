import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { registerSampleRoutes } from "./modules/sample/router";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(helmet);
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await app.register(cookie);

await app.register((instance) => {
    registerSampleRoutes(instance);
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host }).catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
});

