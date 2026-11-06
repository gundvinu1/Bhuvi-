# BHUVI – Development Conventions

## Code Style

### TypeScript
- **Strict mode** is enabled globally (`strict: true` in `tsconfig.base.json`)
- No `any` types without explicit justification and `// eslint-disable` comment
- Prefer `unknown` over `any` for external data
- Use `const assertions` (`as const`) for literal types
- Always use `void` for unhandled promises in event handlers

### Naming Conventions

| Construct | Convention | Example |
|-----------|-----------|---------|
| Files | `kebab-case` | `health.service.ts` |
| Classes | `PascalCase` | `HealthService` |
| Interfaces | `PascalCase` with `I` optional | `ApiResponse` |
| Type aliases | `PascalCase` | `HealthCheckResponse` |
| Enums | `PascalCase` values | `BhuviErrorCode.NOT_FOUND` |
| Functions | `camelCase` | `getHealth()` |
| Variables | `camelCase` | `const startTime` |
| Constants | `SCREAMING_SNAKE_CASE` | `APP_NAME` |
| Environment vars | `SCREAMING_SNAKE_CASE` | `API_PORT` |

### File Organization (NestJS)
Each feature module follows:
```
feature/
├── feature.module.ts
├── feature.controller.ts
├── feature.service.ts
├── feature.controller.spec.ts
├── dto/
│   ├── create-feature.dto.ts
│   └── update-feature.dto.ts
└── entities/
    └── feature.entity.ts
```

## Git Conventions

### Branch Naming
```
feature/module-XX-short-description
fix/short-description
docs/short-description
chore/short-description
```

### Commit Messages (Conventional Commits)
```
feat(module-01): add health check endpoint
fix(api): handle missing environment variable gracefully
docs(architecture): add module dependency graph
chore(deps): upgrade typescript to 5.5
test(health): add controller unit tests
```

## Environment Configuration

- All environment variables are defined in `.env.example`
- Copy `.env.example` → `.env` and fill in values
- **Never commit `.env`** (enforced by `.gitignore`)
- Access env vars via `process.env['VAR_NAME']` (bracket notation prevents `no-process-env` lint issues)
- Use `@nestjs/config` in the API for typed, validated config access

## API Design

- All endpoints are prefixed `/api/v1`
- Responses follow the `ApiResponse<T>` envelope from `@bhuvi/shared`
- Errors use `ApiErrorResponse` from `@bhuvi/shared`
- Use HTTP status codes correctly (200, 201, 400, 401, 403, 404, 422, 500)
- Validate all request bodies using `class-validator` DTOs

## Testing

- Unit test files: `*.spec.ts` co-located with source
- Integration tests: `*.e2e-spec.ts` in a `test/` directory
- Minimum: test the happy path and common error cases for each service method
- Run tests before merging: `pnpm test`

## Windows Compatibility Rules

1. Use `path.join()` or Node.js path utilities — never hardcode `/` separators
2. All scripts must run in PowerShell without requiring WSL
3. Use `Cross-Env` for environment variable injection in npm scripts if needed
4. Docker is optional for development (required for production in Module 18)
5. Ollama has a native Windows installer — no Docker dependency for AI

## Package Dependencies

- **Never add a dependency without a clear reason**
- Prefer packages in `@bhuvi/shared` for cross-cutting concerns
- Avoid circular dependencies between packages
- Keep `devDependencies` out of `dependencies`

## Logging

- Use structured logging (JSON in production, pretty in development)
- Log levels: `debug` | `log` | `warn` | `error`
- Never log secrets, tokens, or personal data
- Include context in every log entry

