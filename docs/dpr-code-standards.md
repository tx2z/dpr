# dpr — Code Standards & Best Practices

This document defines the coding standards, tooling configuration, and architectural principles for the `dpr` project.

## Core Principles

### KISS (Keep It Simple, Stupid)
- Prefer simple, readable solutions over clever ones
- Each function should do one thing well
- Avoid premature optimization
- If a solution requires extensive comments to explain, simplify it

### DRY (Don't Repeat Yourself)
- Extract repeated logic into reusable functions/hooks
- Use composition over inheritance
- Create shared utilities for common operations
- But: don't over-abstract — two similar things are okay, three means refactor

### YAGNI (You Aren't Gonna Need It)
- Don't build features "just in case"
- Implement only what's needed for the current spec
- Future enhancements go in the "Future Enhancements" section, not the code

### Single Responsibility Principle
- Each module/component has one reason to change
- Separate concerns: UI, business logic, data access
- Keep components focused and composable

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.Fragment"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Key TypeScript Rules

1. **No `any`** — Use `unknown` and narrow types
2. **Explicit return types** — All exported functions must have explicit return types
3. **Readonly by default** — Use `readonly` for arrays/objects that shouldn't mutate
4. **Discriminated unions** — Prefer over optional properties for state machines
5. **Exhaustive checks** — Use `never` type for exhaustive switch/if statements

```typescript
// ✅ Good: Discriminated union for service state
type ServiceState =
  | { status: 'stopped' }
  | { status: 'starting'; startedAt: Date }
  | { status: 'running'; pid: number; startedAt: Date }
  | { status: 'stopping' };

// ✅ Good: Exhaustive check
function getStateLabel(state: ServiceState): string {
  switch (state.status) {
    case 'stopped': return 'Stopped';
    case 'starting': return 'Starting...';
    case 'running': return `Running (PID: ${state.pid})`;
    case 'stopping': return 'Stopping...';
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled state: ${_exhaustive}`);
    }
  }
}
```

## ESLint Configuration

### .eslintrc.cjs

```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'unicorn',
    'sonarjs',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:unicorn/recommended',
    'plugin:sonarjs/recommended',
    'prettier', // Must be last
  ],
  rules: {
    // TypeScript strict rules
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'interface', format: ['PascalCase'] },
      { selector: 'typeAlias', format: ['PascalCase'] },
      { selector: 'enum', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['UPPER_CASE'] },
      { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
      { selector: 'function', format: ['camelCase', 'PascalCase'] }, // PascalCase for React components
      { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
    ],

    // Import rules
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
    'import/no-default-export': 'off', // React components often use default exports
    'import/no-duplicates': 'error',
    'import/no-cycle': 'error',

    // Unicorn rules (customize as needed)
    'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    'unicorn/prevent-abbreviations': 'off', // We use common abbreviations
    'unicorn/no-null': 'off', // React uses null
    'unicorn/no-array-reduce': 'off', // Sometimes reduce is cleaner
    'unicorn/prefer-module': 'error',
    'unicorn/prefer-node-protocol': 'error',

    // SonarJS rules for code quality
    'sonarjs/cognitive-complexity': ['error', 15],
    'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
    'sonarjs/no-identical-functions': 'error',

    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
    'object-shorthand': 'error',
    'no-nested-ternary': 'error',
    'max-depth': ['error', 4],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
    'complexity': ['error', 10],
  },
  settings: {
    'import/resolver': {
      typescript: true,
      node: true,
    },
  },
  overrides: [
    {
      files: ['*.test.ts', '*.spec.ts'],
      rules: {
        'max-lines-per-function': 'off',
        'sonarjs/no-duplicate-string': 'off',
      },
    },
  ],
};
```

## Prettier Configuration

### .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "quoteProps": "as-needed"
}
```

### .prettierignore

```
dist/
node_modules/
coverage/
*.md
```

## Project Structure

```
dpr/
├── .eslintrc.cjs
├── .prettierrc
├── .prettierignore
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.tsx              # CLI entry point (thin, just bootstrapping)
│   ├── app.tsx                # Main App component
│   │
│   ├── config/
│   │   ├── index.ts           # Re-exports
│   │   ├── loader.ts          # Config file discovery and loading
│   │   ├── schema.ts          # Zod schema for validation
│   │   ├── dependencies.ts    # Dependency graph & topological sort
│   │   └── types.ts           # TypeScript interfaces (derived from schema)
│   │
│   ├── components/
│   │   ├── index.ts           # Re-exports
│   │   ├── layout.tsx         # Grid layout manager
│   │   ├── space.tsx          # Individual service panel
│   │   ├── header.tsx         # Top bar with global controls
│   │   ├── footer.tsx         # Status bar
│   │   ├── command-palette.tsx
│   │   ├── search-bar.tsx     # Search input and highlighting
│   │   ├── button.tsx         # Reusable button component
│   │   └── log-view.tsx       # Scrollable log display with search highlighting
│   │
│   ├── hooks/
│   │   ├── index.ts           # Re-exports
│   │   ├── use-process.ts     # Process spawn/kill logic
│   │   ├── use-keyboard.ts    # Keyboard event handling
│   │   ├── use-commands.ts    # Command palette logic
│   │   └── use-search.ts      # Search state and navigation
│   │
│   ├── services/
│   │   ├── index.ts           # Re-exports
│   │   └── process-manager.ts # Process lifecycle management
│   │
│   ├── types/
│   │   └── index.ts           # Shared types
│   │
│   └── utils/
│       ├── index.ts           # Re-exports
│       ├── logger.ts          # Internal logging utility
│       ├── file-logger.ts     # Log persistence to file
│       └── signal.ts          # Signal handling utilities
│
├── example/
│   └── dpr.yaml               # Example configuration
│
└── tests/
    ├── config/
    │   ├── loader.test.ts
    │   └── dependencies.test.ts
    ├── services/
    │   └── process-manager.test.ts
    └── utils/
        ├── signal.test.ts
        └── file-logger.test.ts
```

## Code Organization Rules

### File Naming
- **kebab-case** for all files: `command-palette.tsx`, `use-process.ts`
- **PascalCase** for React components inside files
- Test files: `*.test.ts` or `*.spec.ts`

### Module Organization
- Each directory has an `index.ts` that re-exports public API
- Keep internal utilities private (don't export from index)
- Group by feature, not by type (e.g., `config/` not `schemas/`)

### Component Structure

```typescript
// ✅ Good: Component file structure
import type { FC, ReactNode } from 'react';

import { Box, Text } from 'ink';

import { useProcess } from '../hooks/index.js';

import type { ServiceConfig } from '../types/index.js';

// Types first
interface SpaceProps {
  readonly config: ServiceConfig;
  readonly index: number;
  readonly onFocus: () => void;
}

// Component
export const Space: FC<SpaceProps> = ({ config, index, onFocus }) => {
  // Hooks
  const { state, start, stop } = useProcess(config);

  // Event handlers
  const handleStart = (): void => {
    start();
  };

  // Render
  return (
    <Box flexDirection="column">
      <Text>{config.name}</Text>
    </Box>
  );
};
```

### Error Handling

```typescript
// ✅ Good: Use Result type for operations that can fail
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// ✅ Good: Explicit error types
class ConfigNotFoundError extends Error {
  constructor(searchedPaths: readonly string[]) {
    super(`Config not found. Searched: ${searchedPaths.join(', ')}`);
    this.name = 'ConfigNotFoundError';
  }
}

// ✅ Good: Function that returns Result
function loadConfig(path: string): Result<Config, ConfigNotFoundError> {
  // ...
}
```

## Dependencies

### Required Dev Dependencies

```json
{
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-import-resolver-typescript": "^3.0.0",
    "eslint-plugin-import": "^2.29.0",
    "eslint-plugin-sonarjs": "^0.25.0",
    "eslint-plugin-unicorn": "^52.0.0",
    "prettier": "^3.2.0",
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

## Git Hooks (Optional but Recommended)

### package.json scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.tsx",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src",
    "format:check": "prettier --check src",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "validate": "npm run typecheck && npm run lint && npm run format:check && npm run test",
    "prepare": "husky"
  }
}
```

### Husky + lint-staged (optional)

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

## Testing Guidelines

### Testing Philosophy
- Test behavior, not implementation
- Each test should test one thing
- Use descriptive test names that read like specifications
- Prefer integration tests for hooks, unit tests for utilities

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { loadConfig } from './loader.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when config file exists', () => {
    it('parses valid YAML configuration', async () => {
      // Arrange
      const configPath = '/path/to/dpr.yaml';

      // Act
      const result = await loadConfig(configPath);

      // Assert
      expect(result.success).toBe(true);
    });

    it('validates required fields', async () => {
      // ...
    });
  });

  describe('when config file is missing', () => {
    it('returns ConfigNotFoundError', async () => {
      // ...
    });
  });
});
```

## Code Review Checklist

Before submitting code, verify:

- [ ] TypeScript strict mode passes with no errors
- [ ] ESLint passes with no errors or warnings
- [ ] Prettier formatting applied
- [ ] All exported functions have explicit return types
- [ ] No `any` types (use `unknown` if needed)
- [ ] Error cases handled explicitly
- [ ] Complex logic has comments explaining *why*, not *what*
- [ ] Functions are under 50 lines
- [ ] Cognitive complexity under 15
- [ ] Tests cover happy path and error cases

## Anti-patterns to Avoid

```typescript
// ❌ Bad: Using any
function process(data: any) { ... }

// ❌ Bad: Implicit returns
const getValue = () => someCondition ? 'a' : 'b';

// ❌ Bad: Nested ternaries
const result = a ? (b ? 'x' : 'y') : (c ? 'z' : 'w');

// ❌ Bad: Magic numbers
if (services.length > 6) { ... }

// ❌ Bad: Mutable state where immutable works
let items = [];
items.push(newItem);

// ❌ Bad: Side effects in render
const Component = () => {
  localStorage.setItem('key', 'value'); // Side effect!
  return <div />;
};

// ❌ Bad: Ignoring errors
try { doSomething(); } catch { /* ignore */ }
```

```typescript
// ✅ Good alternatives
function process(data: unknown): ProcessedData { ... }

const getValue = (): string => (someCondition ? 'a' : 'b');

const getResult = (): string => {
  if (a) return b ? 'x' : 'y';
  return c ? 'z' : 'w';
};

const MAX_SERVICES = 6;
if (services.length > MAX_SERVICES) { ... }

const items = [...existingItems, newItem];

const Component = () => {
  useEffect(() => {
    localStorage.setItem('key', 'value');
  }, []);
  return <div />;
};

try {
  doSomething();
} catch (error) {
  logger.error('Failed to do something', error);
  throw error; // or handle appropriately
}
```
