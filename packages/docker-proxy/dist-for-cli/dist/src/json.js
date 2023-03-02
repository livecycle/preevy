export const tryParseJson = (...args) => {
    try {
        return JSON.parse(...args);
    }
    catch (e) {
        return undefined;
    }
};
//# sourceMappingURL=json.js.map