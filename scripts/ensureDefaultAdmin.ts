import { verifyDatabaseConnection } from "../src/config/database";
import logger from "../src/config/logger";
import { ensureDefaultAdmin } from "../src/services/auth.service";

const run = async () => {
  await verifyDatabaseConnection();
  await ensureDefaultAdmin({ resetIfExists: true });
  logger.info("Default admin ensured", {
    username: "gloire.mpanga",
    role: "ADMIN_SYSTEME",
    post: "DIRECTION_GENERALE",
  });
  process.exit(0);
};

run().catch((error) => {
  logger.error("Failed to ensure default admin", error);
  process.exit(1);
});
