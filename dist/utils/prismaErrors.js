"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePrismaError = handlePrismaError;
const client_1 = require("@prisma/client");
const errors_1 = require("./errors");
/**
 * Centralized Prisma error handler.
 * Translates Prisma error codes into descriptive, user-facing API responses.
 * Call this in every catch block instead of returning a generic 500.
 */
function handlePrismaError(res, error, entity) {
    // Prisma known request errors (P2xxx codes)
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        const code = error.code;
        const meta = error.meta;
        switch (code) {
            // Unique constraint violation
            case 'P2002': {
                const fields = meta?.target
                    ? Array.isArray(meta.target)
                        ? meta.target.join(', ')
                        : String(meta.target)
                    : 'unknown field';
                (0, errors_1.sendError)(res, 409, `${entity.toUpperCase()}_DUPLICATE`, `A ${entity.toLowerCase()} with this ${fields} already exists.`);
                return;
            }
            // Record not found (delete/update on non-existent record)
            case 'P2025': {
                const cause = meta?.cause ? String(meta.cause) : `${entity} not found`;
                (0, errors_1.sendError)(res, 404, `${entity.toUpperCase()}_NOT_FOUND`, cause);
                return;
            }
            // Foreign key constraint failed
            case 'P2003': {
                const field = meta?.field_name ? String(meta.field_name) : 'related record';
                (0, errors_1.sendError)(res, 400, `${entity.toUpperCase()}_FOREIGN_KEY_ERROR`, `The referenced ${field.replace(/_id$/, '').replace(/_/g, ' ')} does not exist.`);
                return;
            }
            // Required field missing (null constraint)
            case 'P2011': {
                const field = meta?.constraint ? String(meta.constraint) : 'required field';
                (0, errors_1.sendError)(res, 400, `${entity.toUpperCase()}_VALIDATION_ERROR`, `Missing required field: ${field}.`);
                return;
            }
            // Value too long for column
            case 'P2000': {
                (0, errors_1.sendError)(res, 400, `${entity.toUpperCase()}_VALIDATION_ERROR`, `One or more field values exceed the maximum allowed length.`);
                return;
            }
            // Invalid value for field type
            case 'P2005':
            case 'P2006': {
                const field = meta?.field_name ? String(meta.field_name) : 'a field';
                (0, errors_1.sendError)(res, 400, `${entity.toUpperCase()}_VALIDATION_ERROR`, `Invalid value provided for field: ${field}.`);
                return;
            }
            // Related record not found (connect/connectOrCreate)
            case 'P2015': {
                (0, errors_1.sendError)(res, 400, `${entity.toUpperCase()}_FOREIGN_KEY_ERROR`, `A related record required for this operation could not be found.`);
                return;
            }
            // Inconsistent column data
            case 'P2023': {
                (0, errors_1.sendError)(res, 400, `${entity.toUpperCase()}_VALIDATION_ERROR`, `Inconsistent data: one or more fields contain invalid values.`);
                return;
            }
            default: {
                // Log the full Prisma error for debugging but return a structured response
                console.error(`[Prisma ${code}] ${entity}:`, error.message, meta);
                (0, errors_1.sendError)(res, 500, `${entity.toUpperCase()}_DATABASE_ERROR`, `A database error occurred (code: ${code}). Please check your request and try again.`);
                return;
            }
        }
    }
    // Prisma validation errors (invalid query construction)
    if (error instanceof client_1.Prisma.PrismaClientValidationError) {
        console.error(`[Prisma Validation] ${entity}:`, error.message);
        // Extract the most useful part of the validation message
        const lines = error.message.split('\n').filter(l => l.trim());
        const hint = lines.find(l => l.includes('Unknown') || l.includes('Invalid') || l.includes('Argument')) || lines[lines.length - 1];
        (0, errors_1.sendError)(res, 400, `${entity.toUpperCase()}_VALIDATION_ERROR`, `Invalid request data: ${hint?.trim() || 'please check all field names and types.'}`);
        return;
    }
    // Prisma initialization errors
    if (error instanceof client_1.Prisma.PrismaClientInitializationError) {
        console.error(`[Prisma Init] ${entity}:`, error.message);
        (0, errors_1.sendError)(res, 503, `DATABASE_UNAVAILABLE`, `The database is temporarily unavailable. Please try again shortly.`);
        return;
    }
    // Prisma connection errors
    if (error instanceof client_1.Prisma.PrismaClientRustPanicError) {
        console.error(`[Prisma Panic] ${entity}:`, error.message);
        (0, errors_1.sendError)(res, 503, `DATABASE_UNAVAILABLE`, `A critical database error occurred. Please try again shortly.`);
        return;
    }
    // Generic JavaScript errors (type errors, etc.)
    if (error instanceof Error) {
        console.error(`[${entity} Error]:`, error.message, error.stack);
        (0, errors_1.sendError)(res, 500, `${entity.toUpperCase()}_INTERNAL_ERROR`, `An unexpected error occurred: ${error.message}`);
        return;
    }
    // Unknown error type
    console.error(`[${entity} Unknown Error]:`, error);
    (0, errors_1.sendError)(res, 500, `${entity.toUpperCase()}_INTERNAL_ERROR`, `An unexpected error occurred. Please try again.`);
}
