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
echo Running Compiled JS Tests (dist)...
echo.
call node tests/dist_verify.js
echo.
echo Running Minified Bundle Tests...
echo.
call node tests/min_verify.js
echo.
echo ---------------------------------------
echo Tests completed.
echo.
