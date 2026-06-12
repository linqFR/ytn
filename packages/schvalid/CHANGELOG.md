# @ytn/schvalid

## 0.2.2

### Patch Changes

- Extract DNA JS builder from @ytn/schvalid into new @ytn/dna package, refactor DNA type structure (tsDnaOpcode, tsDna), wrap generated validator/parser functions in context closure, remove deprecated schvalid files, add Zod test suite port, and enable IDE type checking for tests by removing them from tsconfig.base.json exclude
- Updated dependencies
  - @ytn/dna@0.2.0

## 0.2.1

### Patch Changes

- Extract DNA JS builder from @ytn/schvalid into new @ytn/dna package, refactor DNA type structure (tsDnaOpcode, tsDna), wrap generated validator/parser functions in context closure, remove deprecated schvalid files, add Zod test suite port, and enable IDE type checking for tests by removing them from tsconfig.base.json exclude
- Updated dependencies
  - @ytn/dna@0.1.0

## 0.2.0

### Minor Changes

- - Refactor to use @ytn/dna as dependency for validation engine
  - Add convenience validate() and parse() functions combining schema conversion and validation
  - Create tsup build configuration with DTS generation
  - Add README documentation with usage examples
  - Configure test scripts (test, test:full, test:performance)
  - Update performance tests to use build output
