@echo off
echo.
echo Running Zod v4 Compliance Tests...
echo ---------------------------------------
echo.
call npx tsx tests/v4_compliance_verify.ts
echo.
echo Running Query Construction Tests...
echo.
call npx tsx tests/query_construction_verify.ts
echo.
echo Running Advanced Query Tests...
echo.
call npx tsx tests/advanced_query_verify.ts
echo.
echo Running Documentation Examples (README)...
echo.
call npx tsx tests/readme_examples.test.ts
echo.
echo Running Compiled JS Tests (dist)...
echo.
call npx tsx tests/dist_verify.ts
echo.
echo Running Minified Bundle Tests...
echo.
call npx tsx tests/min_verify.ts
echo.
echo ---------------------------------------
echo Tests completed.
echo.
