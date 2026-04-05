import { describe, expect, it } from 'vitest';
import { z } from "zod";
import { QueryBuilder } from "../src/index.js";

describe("README Examples Verification", () => {
    it("Basic Selection", () => {
        const sql = QueryBuilder.table("users")
            .select(["id", "name"])
            .where(["id"])
            .build();
        expect(sql.trim()).toBe("SELECT id, name FROM users WHERE id = @id");
    });

    it("Standard Table Joins", () => {
        const sql = QueryBuilder.table("users", "u")
            .select(["u.name", "p.title"])
            .joinInner("posts p", "u.id = p.user_id")
            .build();
        expect(sql.trim()).toBe("SELECT u.name, p.title FROM users u INNER JOIN posts p ON u.id = p.user_id");
    });

    it("Subquery Joins", () => {
        const latestVersion = QueryBuilder.table("tool_versions")
            .select(["tool_uuid", "version"])
            .orderBy("created_at", "DESC")
            .limit(1);

        const sql = QueryBuilder.table("tools", "t")
            .select(["t.name", "latest.version"])
            .joinLeft(latestVersion, "latest", "t.uuid = latest.tool_uuid")
            .build();
        
        expect(sql).toContain("LEFT JOIN (SELECT tool_uuid, version FROM tool_versions ORDER BY created_at DESC LIMIT 1) latest ON t.uuid = latest.tool_uuid");
    });

    it("Inserting Data", () => {
        const sql = QueryBuilder.table("logs")
            .insert(["level", "message", "timestamp"])
            .build();
        expect(sql.trim()).toBe("INSERT INTO logs (level, message, timestamp) VALUES (@level, @message, @timestamp)");
    });

    it("Updating Data", () => {
        const sql = QueryBuilder.table("tools")
            .update(["name"])
            .where(["uuid"])
            .whereIn("status", ["draft", "pending"])
            .build();
        expect(sql.trim()).toBe("UPDATE tools SET name = @name WHERE uuid = @uuid AND status IN ('draft', 'pending')");
    });

    it("Deleting Data", () => {
        const sql = QueryBuilder.table("logs")
            .delete()
            .where([{ col: "created_at", param: "threshold" }])
            .build();
        expect(sql.trim()).toBe("DELETE FROM logs WHERE created_at = @threshold");
    });

    it("RETURNING Clause", () => {
        const sql = QueryBuilder.table("users")
            .insert(["name"])
            .returning(["id", "created_at"])
            .build();
        expect(sql.trim()).toBe("INSERT INTO users (name) VALUES (@name) RETURNING id, created_at");
    });

    it("SQLite Configuration (Pragmas)", () => {
        const sql = QueryBuilder.pragma()
            .foreignKeys(true)
            .journalMode("WAL")
            .synchronous("NORMAL")
            .cacheSize(-32000)
            .build();
        expect(sql).toContain("PRAGMA journal_mode = WAL;");
        expect(sql).toContain("PRAGMA foreign_keys = ON;");
    });

    it("Ordering & Limits", () => {
        const sql = QueryBuilder.table("events")
            .select()
            .orderBy("created_at", "DESC")
            .limit(10)
            .build();
        expect(sql.trim()).toBe("SELECT * FROM events ORDER BY created_at DESC LIMIT 10");
    });

    it("Text Search", () => {
        const sql = QueryBuilder.table("docs")
            .search(["title", "content"], ["type"])
            .build();
        expect(sql.trim()).toBe("SELECT * FROM docs WHERE (title LIKE @search_term OR content LIKE @search_term) AND type = @type");
    });

    it("Existence Predicates (EXISTS)", () => {
        const hasOrders = QueryBuilder.table("orders", "o")
            .whereColumn("o.user_id", "u.id")
            .asExists();

        const sql = QueryBuilder.table("users", "u")
            .select(["name"])
            .whereRaw(hasOrders)
            .build();
        expect(sql).toContain("WHERE EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)");
    });

    it("Declarative CASE Statements", () => {
        const hasPublishedPrompts = "EXISTS (SELECT * FROM prompts p WHERE p.tool_uuid = t.uuid AND p.status = 'published')";
        const sql = QueryBuilder.table("tools", "t")
            .select(["name"])
            .selectCase(
                "status",
                [
                    {
                        when: QueryBuilder.table("prompt_tools", "pt")
                            .whereColumn("pt.tool_uuid", "t.uuid")
                            .asNotExists(),
                        then: "'unused'",
                    },
                    {
                        when: hasPublishedPrompts,
                        then: "'locked'",
                    },
                ],
                "'linked'",
            )
            .build();
        expect(sql).toContain("CASE WHEN NOT EXISTS");
        expect(sql).toContain("ELSE 'linked' END as status");
    });

    it("Fine-Grained Filtering (Correlated Subquery)", () => {
        const recentVersion = QueryBuilder.table("tool_versions", "tv")
            .whereColumn("tv.tool_uuid", "t.uuid")
            .whereLiteral("tv.version", "'1.0.0'")
            .limit(1);

        const sql = QueryBuilder.table("tools", "t")
            .whereIn("uuid", recentVersion)
            .build();
        expect(sql).toContain("WHERE uuid IN (SELECT * FROM tool_versions tv WHERE tv.tool_uuid = t.uuid AND tv.version = '1.0.0' LIMIT 1)");
    });

    it("WHERE IN (Values)", () => {
        const sqlValues = QueryBuilder.table("tools")
            .whereIn("uuid", ["value1", "value2"])
            .build();
        expect(sqlValues.trim()).toBe("SELECT * FROM tools WHERE uuid IN ('value1', 'value2')");
    });

    it("Grouping & Pagination", () => {
        const sql = QueryBuilder.table("events")
            .select(["type"])
            .selectRaw("COUNT(*) as cnt")
            .groupBy(["type"])
            .orderBy("type", "ASC")
            .limit(10)
            .offset(20)
            .build();
        expect(sql.trim()).toBe("SELECT type, COUNT(*) as cnt FROM events GROUP BY type ORDER BY type ASC LIMIT 10 OFFSET 20");
    });

    it("DDL & Schema Generation (Zod 4)", () => {
        const UserSchema = z.object({
            id: z.string().uuid().meta({ pk: true }),
            email: z.string().email().meta({ unique: true }),
            role: z.string().meta({ defaultValue: "'user'" }),
            created_at: z.date().optional(),
        });

        const ddl = QueryBuilder.createTableFromZod("users", UserSchema);
        expect(ddl).toContain("id TEXT PRIMARY KEY");
        expect(ddl).toContain("email TEXT UNIQUE NOT NULL");
    });

    it("Foreign Keys Metadata", () => {
        const PostSchema = z.object({
            id: z.number().int().meta({ pkauto: true }),
            user_id: z.string().uuid().meta({
                fk: { table: "users", col: "id", onDelete: "CASCADE", onUpdate: "CASCADE" },
            }),
        });

        const ddl = QueryBuilder.createTableFromZod("posts", PostSchema);
        expect(ddl).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
        expect(ddl).toContain("FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE");
    });
});
