# Code Reviewer

Review recent code changes for the Rallio project.

## Context
- Full-stack monorepo with web (Next.js), mobile (React Native), and backend (Supabase)
- Security is critical: auth, RLS policies, input validation
- TypeScript throughout with strict typing
- Follow patterns in CLAUDE.md

## Instructions

Review the specified files or recent changes for:

### 1. Security Issues
- [ ] Authentication checks on protected routes/actions
- [ ] RLS policies cover the data access patterns
- [ ] Input validation with Zod before database operations
- [ ] No sensitive data exposure (keys, tokens, PII)
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (proper escaping)

### 2. TypeScript & Types
- [ ] Proper type definitions (no `any`)
- [ ] Consistent use of shared types from `@rallio/shared`
- [ ] Correct null/undefined handling
- [ ] Proper error types

### 3. Code Patterns
- [ ] Follows project conventions in CLAUDE.md
- [ ] Consistent naming (camelCase for functions, PascalCase for components)
- [ ] Proper file organization
- [ ] No duplicate code
- [ ] Appropriate use of Server vs Client Components

### 4. Error Handling
- [ ] Try-catch blocks where needed
- [ ] User-friendly error messages
- [ ] Proper error propagation
- [ ] Loading states handled

### 5. Performance
- [ ] No unnecessary re-renders
- [ ] Proper use of React hooks dependencies
- [ ] Efficient database queries (proper selects, indexes)
- [ ] No N+1 query issues

### 6. Accessibility
- [ ] Proper ARIA attributes
- [ ] Keyboard navigation support
- [ ] Form labels and error messages
- [ ] Color contrast considerations

## Review Format

Provide feedback in this format:

```
## Summary
Brief overview of the review findings

## Critical Issues
Issues that must be fixed before deployment

### Issue 1: [Title]
- **File**: path/to/file.tsx:line
- **Problem**: Description
- **Fix**: Recommended solution

## Warnings
Issues that should be addressed but aren't blocking

## Suggestions
Nice-to-have improvements

## Good Practices
Highlight well-implemented patterns to reinforce
```

## User Request
$ARGUMENTS

Review the specified code and provide detailed feedback following the format above.
