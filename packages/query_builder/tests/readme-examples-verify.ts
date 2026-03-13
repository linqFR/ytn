import { z } from "zod";
import { QueryBuilder } from "../src/index.js";
import { TestRunner } from "./infra.js";

const runner = new TestRunner("README Examples Verification");

runner.it("Basic Selection", () => {
    const sql = QueryBuilder.table("users")
        .select(["id", "name"])
        .where(["id"])
        .build();
    runner.assertSQL(sql, "SELECT id, name FROM users WHERE id = @id");
});

runner.it("Standard Table Joins", () => {
    const sql = QueryBuilder.table("users", "u")
        .select(["u.name", "p.title"])
        .joinInner("posts p", "u.id = p.user_id")
        .build();
    runner.assertSQL(sql, "SELECT u.name, p.title FROM users u INNER JOIN posts p ON u.id = p.user_id");
});

runner.it("Subquery Joins", () => {
    const latestVersion = QueryBuilder.table("tool_versions")
        .select(["tool_uuid", "version"])
        .orderBy("created_at", "DESC")
        .limit(1);

    const sql = QueryBuilder.table("tools", "t")
        .select(["t.name", "latest.version"])
        .joinLeft(latestVersion, "latest", "t.uuid = latest.tool_uuid")
        .build();
    
    runner.assertContains(sql, "LEFT JOIN (SELECT tool_uuid, version FROM tool_versions ORDER BY created_at DESC LIMIT 1) latest ON t.uuid = latest.tool_uuid");
});

runner.it("Inserting Data", () => {
    const sql = QueryBuilder.table("logs")
        .insert(["level", "message", "timestamp"])
        .build();
    runner.assertSQL(sql, "INSERT INTO logs (level, message, timestamp) VALUES (@level, @message, @timestamp)");
});

runner.it("Updating Data", () => {
    const sql = QueryBuilder.table("tools")
        .update(["name"])
        .where(["uuid"])
        .whereIn("status", ["draft", "pending"])
        .build();
    runner.assertSQL(sql, "UPDATE tools SET name = @name WHERE uuid = @uuid AND status IN ('draft', 'pending')");
});

runner.it("Deleting Data", () => {
    const sql = QueryBuilder.table("logs")
        .delete()
        .where([{ col: "created_at", param: "threshold" }])
        .build();
    runner.assertSQL(sql, "DELETE FROM logs WHERE created_at = @threshold");
});

runner.it("RETURNING Clause", () => {
    const sql = QueryBuilder.table("users")
        .insert(["name"])
        .returning(["id", "created_at"])
        .build();
    runner.assertSQL(sql, "INSERT INTO users (name) VALUES (@name) RETURNING id, created_at");
});

runner.it("SQLite Configuration (Pragmas)", () => {
    const sql = QueryBuilder.pragma()
        .foreignKeys(true)
        .journalMode("WAL")
        .synchronous("NORMAL")
        .cacheSize(-32000)
        .build();
    runner.assertContains(sql, "PRAGMA journal_mode = WAL;");
    runner.assertContains(sql, "PRAGMA foreign_keys = ON;");
});

runner.it("Ordering & Limits", () => {
    const sql = QueryBuilder.table("events")
        .select()
        .orderBy("created_at", "DESC")
        .limit(10)
        .build();
    runner.assertSQL(sql, "SELECT * FROM events ORDER BY created_at DESC LIMIT 10");
});

runner.it("Text Search", () => {
    const sql = QueryBuilder.table("docs")
        .search(["title", "content"], ["type"])
        .build();
    runner.assertSQL(sql, "SELECT * FROM docs WHERE (title LIKE ? OR content LIKE ?) AND type = @type");
});

runner.it("Existence Predicates (EXISTS)", () => {
    const hasOrders = QueryBuilder.table("orders", "o")
        .whereColumn("o.user_id", "u.id")
        .asExists();

    const sql = QueryBuilder.table("users", "u")
        .select(["name"])
        .whereRaw(hasOrders)
        .build();
    runner.assertContains(sql, "WHERE EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)");
});

runner.it("Declarative CASE Statements", () => {
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
    runner.assertContains(sql, "CASE WHEN NOT EXISTS");
    runner.assertContains(sql, "ELSE 'linked' END as status");
});

runner.it("Fine-Grained Filtering (Correlated Subquery)", () => {
    const recentVersion = QueryBuilder.table("tool_versions", "tv")
        .whereColumn("tv.tool_uuid", "t.uuid")
        .whereLiteral("tv.version", "'1.0.0'")
        .limit(1);

    const sql = QueryBuilder.table("tools", "t")
        .whereIn("uuid", recentVersion)
        .build();
    runner.assertContains(sql, "WHERE uuid IN (SELECT * FROM tool_versions tv WHERE tv.tool_uuid = t.uuid AND tv.version = '1.0.0' LIMIT 1)");
});

runner.it("WHERE IN (Values)", () => {
    const sqlValues = QueryBuilder.table("tools")
        .whereIn("uuid", ["value1", "value2"])
        .build();
    runner.assertSQL(sqlValues, "SELECT * FROM tools WHERE uuid IN ('value1', 'value2')");
});

runner.it("Grouping & Pagination", () => {
    const sql = QueryBuilder.table("events")
        .select(["type"])
        .selectRaw("COUNT(*) as cnt")
        .groupBy(["type"])
        .orderBy("type", "ASC")
        .limit(10)
        .offset(20)
        .build();
    runner.assertSQL(sql, "SELECT type, COUNT(*) as cnt FROM events GROUP BY type ORDER BY type ASC LIMIT 10 OFFSET 20");
});

runner.it("DDL & Schema Generation (Zod 4)", () => {
    const UserSchema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        email: z.string().email().meta({ unique: true }),
        role: z.string().meta({ defaultValue: "'user'" }),
        created_at: z.date().optional(),
    });

    const ddl = QueryBuilder.createTableFromZod("users", UserSchema);
    runner.assertContains(ddl, "id TEXT PRIMARY KEY");
    runner.assertContains(ddl, "email TEXT UNIQUE NOT NULL");
});

runner.it("Foreign Keys Metadata", () => {
    const PostSchema = z.object({
        id: z.number().int().meta({ pkauto: true }),
        user_id: z.string().uuid().meta({
            fk: { table: "users", col: "id", onDelete: "CASCADE", onUpdate: "CASCADE" },
        }),
    });

    const ddl = QueryBuilder.createTableFromZod("posts", PostSchema);
    runner.assertContains(ddl, "id INTEGER PRIMARY KEY AUTOINCREMENT");
    runner.assertContains(ddl, "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE");
});

runner.finish();
