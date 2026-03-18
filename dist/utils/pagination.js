"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaginationMeta = exports.getPaginationParams = void 0;
const getPaginationParams = (page, limit) => {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (pageNum - 1) * limitNum;
    return {
        page: pageNum,
        limit: limitNum,
        skip,
    };
};
exports.getPaginationParams = getPaginationParams;
const getPaginationMeta = (page, limit, total) => {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getPaginationMeta = getPaginationMeta;
