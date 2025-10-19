import { setupDbConnection } from "./configs/db";
import { setupServer } from "./configs/server";

async function main() {
    const environment = process.env.NODE_ENV;

    if (!environment) {
        throw new Error("NODE_ENV must be set");
    }

    await setupDbConnection();
    await setupServer();

    console.log("done");
}

main().catch((error) => {
    console.error("Setup failed", error);
    process.exit(1);
});