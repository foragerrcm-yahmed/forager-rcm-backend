import { Response } from 'express';

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public message: string,
    public details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const sendError = (res: Response, statusCode: number, code: string, message: string, details?: ErrorDetail[]): void => {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  });
};

// Convention-based error code generators
export const notFound = (entity: string) => `${entity.toUpperCase()}_NOT_FOUND`;
export const validationError = (entity: string) => `${entity.toUpperCase()}_VALIDATION_ERROR`;
export const duplicate = (entity: string) => `${entity.toUpperCase()}_DUPLICATE`;
export const foreignKeyError = (entity: string) => `${entity.toUpperCase()}_FOREIGN_KEY_ERROR`;
export const unauthorized = (entity: string) => `${entity.toUpperCase()}_UNAUTHORIZED`;
export const forbidden = (entity: string) => `${entity.toUpperCase()}_FORBIDDEN`;
export const deleteFailed = (entity: string) => `${entity.toUpperCase()}_DELETE_FAILED`;
export const createFailed = (entity: string) => `${entity.toUpperCase()}_CREATE_FAILED`;
export const updateFailed = (entity: string) => `${entity.toUpperCase()}_UPDATE_FAILED`;

