import type { FastifyInstance, FastifyRequest } from "fastify";
import { createSample, deleteSample, getSampleById, listSamples, updateSample } from "./service";

export function registerSampleRoutes(app: FastifyInstance) {
    app.get("/sample", async () => {
        return await listSamples();
    });

    app.get<{ Params: { id: string } }>("/sample/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
        return await getSampleById(request.params.id);
    });

    app.post<{ Body: { data: string } }>("/sample", async (request: FastifyRequest<{ Body: { data: string } }>) => {
        return await createSample({ data: request.body.data });
    });

    app.put<{ Params: { id: string }; Body: { data: string } }>("/sample/:id", async (request: FastifyRequest<{ Params: { id: string }; Body: { data: string } }>) => {
        return await updateSample(request.params.id, { data: request.body.data });
    });

    app.delete<{ Params: { id: string } }>("/sample/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
        return await deleteSample(request.params.id);
    });
}

