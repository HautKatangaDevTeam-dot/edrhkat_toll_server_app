import { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError";
import * as authService from "../services/auth.service";
import logger from "../config/logger";
import {
  clearAuthCookies,
  getRefreshTokenFromCookies,
  isMobileClient,
  setAuthCookies,
} from "../utils/authCookies";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password, role, post } = req.body;
    const result = await authService.register(username, password, role, post);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password } = req.body;

    const mobileClient = isMobileClient(req);
    const result = await authService.login(username, password, {
      mobileClient,
    });
    if (!mobileClient) {
      setAuthCookies(res, result);
    }
    logger.info("Auth login success", {
      username: result.user.username,
      role: result.user.role,
      post: result.user.post,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
      authMode: mobileClient ? "token" : "cookie",
    });
    res.json(
      mobileClient
        ? { success: true, ...result }
        : { success: true, user: result.user }
    );
  } catch (error) {
    logger.warn("Auth login failure", {
      username: req.body?.username ?? null,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? null,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const mobileClient = isMobileClient(req);
    const refreshToken =
      req.body?.refreshToken ?? getRefreshTokenFromCookies(req);

    if (!refreshToken) {
      throw new AppError(
        "Session expiree, veuillez vous reconnecter",
        401,
        "AUTH_SESSION_EXPIRED"
      );
    }

    const result = await authService.refreshSession(refreshToken, {
      mobileClient,
    });
    if (!mobileClient) {
      setAuthCookies(res, result);
    }
    logger.info("Auth refresh success", {
      userId: result.user.id,
      username: result.user.username,
      ip: req.ip,
      authMode: mobileClient ? "token" : "cookie",
    });
    res.json(
      mobileClient
        ? { success: true, ...result }
        : { success: true, user: result.user }
    );
  } catch (error) {
    logger.warn("Auth refresh failure", {
      ip: req.ip,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401, "AUTH_UNAUTHORIZED");
    }
    await authService.logout(req.user.id);
    clearAuthCookies(res);
    logger.info("Auth logout success", {
      userId: req.user.id,
      username: req.user.username,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401, "AUTH_UNAUTHORIZED");
    }
    res.json({ success: true, user: req.user });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search, role, post, page = "1", pageSize = "10" } = req.query as {
      search?: string;
      role?: string;
      post?: string;
      page?: string;
      pageSize?: string;
    };
    const result = await authService.listUsers(
      search,
      role,
      post,
      Number(page) || 1,
      Number(pageSize) || 10
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await authService.resetUserPassword(id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { username, role, post, password } = req.body;
    const result = await authService.updateUser(id, username, role, post, password);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
