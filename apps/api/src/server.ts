import { app } from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  console.log(`ERP API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
