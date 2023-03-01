export const requiredEnv = (key) => {
    const result = process.env[key];
    if (!result) {
        throw new Error(`required env var ${key} not set`);
    }
    return result;
};
//# sourceMappingURL=env.js.map