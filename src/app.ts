import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import env from "./config/env";
import routes from "./routes";
import { errorHandler, notFound } from "./middlewares/errorHandler";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins.includes("*")
      ? undefined
      : (origin, callback) => {
          if (!origin || env.corsOrigins.includes(origin)) {
            callback(null, origin);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
    credentials: true,
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
