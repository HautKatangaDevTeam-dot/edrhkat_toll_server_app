import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import * as companyController from "../controllers/company.controller";
import { validateRequest } from "../middlewares/validateRequest";
import {
  companyIdSchema,
  createCompanySchema,
  listCompaniesSchema,
  updateCompanySchema,
} from "../schemas/company.schema";

const router = Router();
const controlRoles = [authenticate, authorize("ADMIN_SYSTEME", "SUPERVISEUR")];

router.post(
  "/",
  ...controlRoles,
  validateRequest(createCompanySchema),
  companyController.createCompany
);

router.get(
  "/",
  ...controlRoles,
  validateRequest(listCompaniesSchema),
  companyController.listCompanies
);

router.get(
  "/:id",
  ...controlRoles,
  validateRequest(companyIdSchema),
  companyController.getCompany
);

router.patch(
  "/:id",
  ...controlRoles,
  validateRequest(updateCompanySchema),
  companyController.updateCompany
);

export default router;
