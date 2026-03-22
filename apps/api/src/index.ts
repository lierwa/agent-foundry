import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const app = buildApp({ logger: true });

app.listen({
  host: "0.0.0.0",
  port,
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
