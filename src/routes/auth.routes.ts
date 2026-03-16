import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { loginRateLimit } from "../middlewares/authRateLimit";
import { validateRequest } from "../middlewares/validateRequest";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  listUsersSchema,
} from "../schemas/auth.schema";

const router = Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  authController.register
);
router.post("/login", loginRateLimit, validateRequest(loginSchema), authController.login);
router.post("/refresh", validateRequest(refreshSchema), authController.refresh);
router.post(
  "/logout",
  authenticate,
  validateRequest(logoutSchema),
  authController.logout
);
router.get("/me", authenticate, authController.me);
router.get(
  "/users",
  authenticate,
  authorize("ADMIN_SYSTEME"),
  validateRequest(listUsersSchema),
  authController.listUsers
);

export default router;
