"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRuleExecutionById = exports.getRuleExecutions = void 0;
const prisma_1 = require("../../generated/prisma");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new prisma_1.PrismaClient();
const getRuleExecutions = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { ruleId, claimId, status, dateFrom, dateTo } = req.query;
        const where = {};
        if (ruleId && typeof ruleId === 'string') {
            where.ruleId = ruleId;
        }
        if (claimId && typeof claimId === 'string') {
            where.claimId = claimId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (dateFrom || dateTo) {
            where.executedAt = {};
            if (dateFrom)
                where.executedAt.gte = BigInt(dateFrom);
            if (dateTo)
                where.executedAt.lte = BigInt(dateTo);
        }
        const [executions, total] = await prisma.$transaction([
            prisma.ruleExecution.findMany({
                where,
                skip,
                take: limit,
            }),
            prisma.ruleExecution.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: executions.map(e => ({
                ...e,
                executedAt: Number(e.executedAt),
            })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'RULE_EXECUTION');
    }
};
exports.getRuleExecutions = getRuleExecutions;
const getRuleExecutionById = async (req, res) => {
    try {
        const { id } = req.params;
        const execution = await prisma.ruleExecution.findUnique({
            where: { id: id },
        });
        if (!execution) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('RULE_EXECUTION'), 'Rule execution not found');
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                ...execution,
                executedAt: Number(execution.executedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'RULE_EXECUTION');
    }
};
exports.getRuleExecutionById = getRuleExecutionById;
