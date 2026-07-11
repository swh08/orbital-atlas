import { mkdir, writeFile } from "node:fs/promises";

const outputDirectory = new URL("../dist/server/", import.meta.url);
const workerSource = `export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(new URL("index.js", outputDirectory), workerSource, "utf8");
