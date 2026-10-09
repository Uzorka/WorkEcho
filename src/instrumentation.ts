// Runs once when the Next.js server starts: fail fast on bad env variables.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { publicEnv } = await import("./lib/env");
    const { serverEnv } = await import("./lib/env.server");
    publicEnv();
    serverEnv();
  }
}
