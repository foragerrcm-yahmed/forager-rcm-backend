"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFailed = exports.createFailed = exports.deleteFailed = exports.forbidden = exports.unauthorized = exports.foreignKeyError = exports.duplicate = exports.validationError = exports.notFound = exports.sendError = exports.AppError = void 0;
class AppError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.message = message;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
const sendError = (res, statusCode, code, message, details) => {
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            ...(details && { details }),
        },
    });
};
exports.sendError = sendError;
// Convention-based error code generators
const notFound = (entity) => `${entity.toUpperCase()}_NOT_FOUND`;
exports.notFound = notFound;
const validationError = (entity) => `${entity.toUpperCase()}_VALIDATION_ERROR`;
exports.validationError = validationError;
const duplicate = (entity) => `${entity.toUpperCase()}_DUPLICATE`;
exports.duplicate = duplicate;
const foreignKeyError = (entity) => `${entity.toUpperCase()}_FOREIGN_KEY_ERROR`;
exports.foreignKeyError = foreignKeyError;
const unauthorized = (entity) => `${entity.toUpperCase()}_UNAUTHORIZED`;
exports.unauthorized = unauthorized;
const forbidden = (entity) => `${entity.toUpperCase()}_FORBIDDEN`;
exports.forbidden = forbidden;
const deleteFailed = (entity) => `${entity.toUpperCase()}_DELETE_FAILED`;
exports.deleteFailed = deleteFailed;
const createFailed = (entity) => `${entity.toUpperCase()}_CREATE_FAILED`;
exports.createFailed = createFailed;
const updateFailed = (entity) => `${entity.toUpperCase()}_UPDATE_FAILED`;
exports.updateFailed = updateFailed;
