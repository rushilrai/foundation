module.exports = {
    apps: [
        {
            name: "keystone",
            cwd: __dirname,
            script: "node",
            args: ["--env-file=.env", "dist/app.cjs"],
            instances: 1,
            exec_mode: "fork",
            watch: false,

            out_file: "logs/out.log",
            error_file: "logs/err.log",
            combine_logs: true,

            env: { NODE_ENV: "production" },
            max_restarts: 5,
            restart_delay: 3000,
        },
    ],
};