import process from "node:process";

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const webUrl = readOption("--web", process.env.WEB_PRODUCTION_URL);
const apiUrl = readOption("--api", process.env.API_PRODUCTION_URL);
const attempts = Number(readOption("--attempts", "30"));
const delayMs = Number(readOption("--delay-ms", "10000"));

if (!webUrl || !apiUrl) {
  throw new Error("Provide --web and --api (or WEB_PRODUCTION_URL and API_PRODUCTION_URL).");
}

const targets = [
  { name: "frontend", url: webUrl, validate: () => true },
  {
    name: "API liveness",
    url: new URL("/health", apiUrl).href,
    validate: (body) => body.status === "ok",
  },
  {
    name: "API readiness",
    url: new URL("/health/ready", apiUrl).href,
    validate: (body) => body.status === "ready",
  },
];

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function check(target) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(target.url, {
        headers: { "user-agent": "brewlite-task5.3-smoke/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json") ? await response.json() : {};
      if (!target.validate(body)) {
        throw new Error(`unexpected response: ${JSON.stringify(body)}`);
      }
      console.log(`PASS ${target.name}: ${target.url}`);
      return;
    } catch (error) {
      lastError = error;
      console.log(`WAIT ${target.name} (${attempt}/${attempts}): ${error.message}`);
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw new Error(`Smoke check failed for ${target.name}: ${lastError?.message}`);
}

for (const target of targets) {
  await check(target);
}
