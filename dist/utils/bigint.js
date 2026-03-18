"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertBigIntToNumber = convertBigIntToNumber;
// Utility function to convert BigInt fields to Numbers for JSON serialization
function convertBigIntToNumber(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'bigint') {
        return Number(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(convertBigIntToNumber);
    }
    if (typeof obj === 'object') {
        const converted = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                converted[key] = convertBigIntToNumber(obj[key]);
            }
        }
        return converted;
    }
    return obj;
}
