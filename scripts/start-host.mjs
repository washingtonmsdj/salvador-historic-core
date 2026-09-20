import { access } from "node:fs/promises";

const output = new URL("../.output/server/index.mjs", import.meta.url);

try {
  await access(output);
} catch {
  console.error(
    "Build de produção não encontrado. Execute `npm run build` antes de `npm start`.",
  );
  process.exit(1);
}

const host = process.env.HOST ?? process.env.NITRO_HOST ?? "0.0.0.0";
process.env.HOST = host;
process.env.NITRO_HOST = host;

if (process.env.PORT && !process.env.NITRO_PORT) {
  process.env.NITRO_PORT = process.env.PORT;
}

await import(output.href);
