declare const _exports: ({
    ignores: string[];
} | {
    languageOptions: {
        parser: typeof import("@typescript-eslint/parser");
        parserOptions: {
            ecmaVersion: number;
            sourceType: string;
            ecmaFeatures: {
                jsx: boolean;
            };
        };
        globals: {
            Atomics: string;
            SharedArrayBuffer: string;
        };
    };
    linterOptions: {
        reportUnusedDisableDirectives: boolean;
    };
    plugins: {
        import: any;
        jest: {
            meta: {
                name: string;
                version: string;
            };
            environments: {
                globals: {
                    globals: {
                        [key: string]: boolean;
                    };
                };
            };
            configs: {
                all: import("eslint").Linter.LegacyConfig;
                recommended: import("eslint").Linter.LegacyConfig;
                style: import("eslint").Linter.LegacyConfig;
                "flat/all": import("eslint").Linter.FlatConfig;
                "flat/recommended": import("eslint").Linter.FlatConfig;
                "flat/style": import("eslint").Linter.FlatConfig;
            };
            rules: {
                [key: string]: import("eslint").Rule.RuleModule;
            };
        };
        "@typescript-eslint": {
            configs: Record<string, import("@typescript-eslint/utils/ts-eslint").ClassicConfig.Config>;
            meta: import("@typescript-eslint/utils/ts-eslint").FlatConfig.PluginMeta;
            rules: typeof import("@typescript-eslint/eslint-plugin/use-at-your-own-risk/rules");
        };
        "@stylistic": typeof import("@stylistic/eslint-plugin", { with: { "resolution-mode": "import" } });
        "@stylistic/ts": typeof import("@stylistic/eslint-plugin-ts", { with: { "resolution-mode": "import" } });
    };
    settings: {
        "import/resolver": {
            node: {
                paths: string[];
            };
        };
        react: {
            version: string;
        };
    };
    rules: {
        "no-void": (string | {
            allowAsStatement: boolean;
        })[];
        "no-param-reassign": (string | {
            props: boolean;
        })[];
        "no-constant-condition": (string | {
            checkLoops: boolean;
        })[];
        "no-restricted-imports": (string | {
            patterns: string[];
        })[];
        "no-unused-expressions": string;
        "no-return-await": string;
        "import/no-extraneous-dependencies": (string | {
            devDependencies: string[];
        })[];
        "max-len": (string | {
            code: number;
            ignoreUrls: boolean;
            ignoreStrings: boolean;
            ignoreTemplateLiterals: boolean;
            ignoreRegExpLiterals: boolean;
        })[];
        "@stylistic/quotes": (string | {
            avoidEscape: boolean;
            allowTemplateLiterals: boolean;
        })[];
        "@stylistic/indent": (string | number)[];
        "@stylistic/semi": string[];
        "@stylistic/comma-dangle": (string | {
            functions: string;
            arrays: string;
            objects: string;
            imports: string;
            exports: string;
        })[];
        "@stylistic/dot-location": string[];
        "@stylistic/no-trailing-spaces": string;
        "@stylistic/no-multi-spaces": string;
        "@stylistic/no-multiple-empty-lines": string;
        "@stylistic/space-infix-ops": string;
        "@stylistic/object-curly-spacing": string[];
        "@stylistic/key-spacing": string;
        "@stylistic/lines-between-class-members": (string | {
            exceptAfterSingleLine: boolean;
        })[];
        "@stylistic/generator-star-spacing": (string | {
            before: boolean;
            after: boolean;
        })[];
        "@stylistic/arrow-parens": string[];
        "@stylistic/comma-spacing": string;
        "@stylistic/object-curly-newline": (string | {
            consistent: boolean;
        })[];
        "@stylistic/ts/member-delimiter-style": (string | {
            multiline: {
                delimiter: string;
                requireLast: undefined;
            };
            singleline: {
                delimiter: string;
                requireLast: undefined;
            };
        })[];
        indent: string;
        "@typescript-eslint/indent": string;
    };
} | {
    files: string[];
    languageOptions: {
        parser: typeof import("@typescript-eslint/parser");
        parserOptions: {
            project: string;
        };
    };
    rules: {
        "no-useless-constructor": string;
        "no-empty-function": string;
        "@stylistic/ts/array-type": string;
        "@typescript-eslint/ban-ts-comment": string;
        "max-classes-per-file": string;
        "import/no-unresolved": string;
        "@typescript-eslint/no-unused-expressions": string[];
        "@typescript-eslint/await-thenable": string;
        "@typescript-eslint/return-await": string[];
        "@typescript-eslint/no-floating-promises": (string | {
            ignoreVoid: boolean;
        })[];
        "@typescript-eslint/no-misused-promises": (string | {
            checksVoidReturn: boolean;
        })[];
        "@typescript-eslint/no-parameter-properties": string;
        "@typescript-eslint/explicit-function-return-type": string;
        "@typescript-eslint/explicit-member-accessibility": string;
        "@typescript-eslint/explicit-module-boundary-types": string;
    };
})[];
export = _exports;
