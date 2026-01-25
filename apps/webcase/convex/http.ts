import { httpRouter } from "convex/server";

import { handleClerkUserWebhook } from "./modules/user/http";

const http = httpRouter();

http.route({
    path: "/clerk-user-webhook",
    method: "POST",
    handler: handleClerkUserWebhook
});

export default http;
