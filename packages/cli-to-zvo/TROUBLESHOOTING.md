# Troubleshooting

This document covers common errors and their solutions when using @ytn/czvo.

## Common Error: "Invalid input"

**Symptom**: Contract validation fails with "Invalid input" errors for multiple fields.

**Cause**: Using string DSL syntax for optional fields.

**Fix**: Replace `"type?"` with `pico.type().optional()`.

**Example**:
```typescript
// Before (fails)
targets: { 
  cmd: { 
    flag: "boolean?",     // Invalid
    verbose: "string?"    // Invalid
  } 
}

// After (works)
targets: { 
  cmd: { 
    flag: pico.boolean().optional(),     // Valid
    verbose: pico.string().optional()    // Valid
  } 
}
```

## Error: Field not defined in 'cli'

**Symptom**: `"ERROR: Field 'destination' is not defined in 'cli'. Is it misspelled?"`

**Cause**: Using a field in targets/fallbacks that wasn't declared in the cli section.

**Fix**: Add the missing field to the cli definition or correct the spelling.

**Example**:
```typescript
// Missing field in cli
cli: { flags: { source: { type: "string" } } },
targets: { copy: { source: "string", dest: "filepath" } } // 'dest' not in cli

// Fixed
cli: { flags: { source: { type: "string" }, dest: { type: "string" } } },
targets: { copy: { source: "string", dest: "filepath" } }
```

## Error: Target fields cannot be empty

**Symptom**: `"ERROR: Target fields cannot be empty. Use 'fallbacks' for catch-all"`

**Cause**: Defining a target with no fields.

**Fix**: Add at least one field or move it to fallbacks for catch-all behavior.

**Example**:
```typescript
// Before (fails)
targets: {
  empty: {} // No fields
}

// After (works)
targets: {
  help: { verbose: "boolean" } // At least one field
},
// OR use fallbacks for catch-all
fallbacks: {
  default: { verbose: "boolean" }
}
```

## Error: Contract exceeds 31 argument limit

**Symptom**: `"ERROR: Contract exceeds 31 unique CLI arguments limit"`

**Cause**: Defining more than 31 unique arguments (positionals + flags) in the cli section.

**Fix**: Reduce the number of unique arguments or split into multiple contracts.

**Example**:
```typescript
// Before (fails - 35 unique arguments)
cli: {
  positionals: ["cmd", "file", "output", "config", "mode", "type", "format", "encoding", 
                "compression", "algorithm", "hash", "salt", "key", "iv", "tag", 
                "nonce", "counter", "index", "offset", "length", "size", "count", 
                "total", "limit", "threshold", "min", "max", "step", "precision", 
                "scale", "unit", "ratio"],
  flags: { /* many flags */ }
}

// After (works - group related arguments)
cli: {
  positionals: ["cmd", "file"], // Core arguments only
  flags: {
    verbose: { type: "boolean" },
    config: { type: "string" }
    // Essential flags only
  }
}
```

## Error: Ambiguous routing

**Symptom**: Multiple targets match the same input pattern.

**Cause**: Two or more targets have identical signatures without literal discriminants.

**Fix**: Add literal discriminants or make signatures unique.

**Example**:
```typescript
// Before (ambiguous)
targets: {
  process1: { file: "string", mode: "string" },
  process2: { file: "string", mode: "string" } // Same signature
}

// After (fixed with literals)
targets: {
  process1: { 
    action: pico.literal("type1"),
    file: "string", 
    mode: "string" 
  },
  process2: { 
    action: pico.literal("type2"),
    file: "string", 
    mode: "string" 
  }
}
```

## Performance Issues

### Slow routing with many targets

**Symptom**: Routing becomes slow as target count increases.

**Cause**: Missing literal discriminants causing sequential fallback.

**Fix**: Ensure each target has a unique literal discriminant.

**Example**:
```typescript
// Before (sequential matching)
targets: {
  download: { url: "string", quality: "string" },
  upload: { url: "string", quality: "string" } // No discriminant
}

// After (O(1) routing)
targets: {
  download: { 
    action: pico.literal("download"), // Discriminant
    url: "string", 
    quality: "string" 
  },
  upload: { 
    action: pico.literal("upload"), // Discriminant
    url: "string", 
    quality: "string" 
  }
}
```

## Type Validation Errors

### Zod validation fails at runtime

**Symptom**: Contract compiles but runtime validation fails.

**Cause**: Mismatch between CLI type and target validation.

**Fix**: Ensure CLI type matches target expectation.

**Example**:
```typescript
// Before (mismatch)
cli: { flags: { force: { type: "boolean" } } }, // boolean flag
targets: { cmd: { force: "string" } } // Expecting string

// After (matched)
cli: { flags: { force: { type: "boolean" } } },
targets: { cmd: { force: "boolean" } } // Correct type
```

## Getting Help

If you encounter issues not covered here:

1. Check the [main README](./README.md) for detailed usage examples
2. Look at the test files for working examples
3. Enable debug mode in contract options for detailed error information
4. Create a minimal reproduction case when reporting issues
