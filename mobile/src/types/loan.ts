// Re-export shim. Source of truth: shared/loan-engine/loan.ts
// Uses mobile/shared -> ../../shared symlink so Metro can index the file
// within the projectRoot (Metro cannot hash files via out-of-root relative imports).
export * from '../../shared/loan-engine/loan';
