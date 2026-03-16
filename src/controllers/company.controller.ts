import { NextFunction, Request, Response } from "express";
import * as companyService from "../services/company.service";
import logger from "../config/logger";

export const createCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, code, billing_mode } = req.body;
    const company = await companyService.create(name, code, billing_mode);
    res.status(201).json({ success: true, company });
  } catch (error) {
    next(error);
  }
};

export const listCompanies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      search,
      page = 1,
      pageSize = 10,
    } = req.query as {
      search?: string;
      page?: string;
      pageSize?: string;
    };

    const result = await companyService.list(
      search,
      Number(page) || 1,
      Number(pageSize) || 10
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info("Fetching company", { id: req.params.id });
    const company = await companyService.get(req.params.id);
    res.json({ success: true, company });
  } catch (error) {
    next(error);
  }
};

export const updateCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const company = await companyService.update(req.params.id, req.body);
    res.json({ success: true, company });
  } catch (error) {
    next(error);
  }
};
