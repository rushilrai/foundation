import { setupDbConnection } from "./configs/db.js";
import { setupServer } from "./configs/server.js";

async function main() {
    const environment = process.env.NODE_ENV;

    if (!environment) {
        throw new Error("NODE_ENV must be set");
    }

    await setupDbConnection();
    await setupServer();

    console.log("keystone running");
}

main().catch((error) => {
    console.error("Setup failed", error);
    process.exit(1);
});