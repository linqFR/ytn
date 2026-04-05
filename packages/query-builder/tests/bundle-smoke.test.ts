
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { QueryBuilder } from "../dist/index.js"; // IMPORT FROM BUNDLE

describe("📦 QB Bundle Smoke Test (dist/index.js)", () => {
  it("should generate a CREATE TABLE statement from the production bundle", () => {
    const UserSchema = z.object({
      id: z.number().int(),
      name: z.string(),
      email: z.string().optional()
    });

    const ddl = QueryBuilder.createTableFromZod("users", UserSchema);
    
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(ddl).toContain("id INTEGER");
    expect(ddl).toContain("name TEXT");
    expect(ddl).toContain("NOT NULL"); // id and name are required
  });
});
