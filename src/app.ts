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

const isAllowedOrigin = (origin: string) => {
  if (env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)) {
    return true;
  }

  if (env.nodeEnv !== "production") {
    try {
      const { hostname } = new URL(origin);
      return hostname === "localhost" || hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }

  return false;
};

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins.includes("*")
      ? undefined
      : (origin, callback) => {
          if (!origin || isAllowedOrigin(origin)) {
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
app.use((req, _res, next) => {
  console.log("[REQ]", {
    method: req.method,
    path: req.originalUrl,
    contentLength: req.headers["content-length"] ?? null,
    contentType: req.headers["content-type"] ?? null,
    requestId: req.headers["x-request-id"] ?? null,
  });
  next();
});
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
