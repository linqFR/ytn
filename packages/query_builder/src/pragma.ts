/**
 * @class PragmaBuilder
 * @description Fluent builder for SQLite PRAGMA statements.
 */
export class PragmaBuilder {
    private _statements: string[] = [];

    /**
     * @function foreignKeys
     * @description Enforces foreign key constraints.
     * @param {boolean} [on=true]
     * @returns {this}
     */
    public foreignKeys(on: boolean = true): this {
        this._statements.push(`PRAGMA foreign_keys = ${on ? 'ON' : 'OFF'};`);
        return this;
    }

    /**
     * @function journalMode
     * @description Sets the journal mode (e.g., WAL, DELETE, MEMORY).
     * @param {'WAL' | 'DELETE' | 'MEMORY' | 'TRUNCATE' | 'PERSIST' | 'OFF'} mode
     * @returns {this}
     */
    public journalMode(mode: 'WAL' | 'DELETE' | 'MEMORY' | 'TRUNCATE' | 'PERSIST' | 'OFF'): this {
        this._statements.push(`PRAGMA journal_mode = ${mode};`);
        return this;
    }

    /**
     * @function synchronous
     * @description Controls disk synchronization (OFF, NORMAL, FULL, EXTRA).
     * @param {'OFF' | 'NORMAL' | 'FULL' | 'EXTRA'} level
     * @returns {this}
     */
    public synchronous(level: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA'): this {
        this._statements.push(`PRAGMA synchronous = ${level};`);
        return this;
    }

    /**
     * @function cacheSize
     * @description Sets the database cache size.
     * @param {number} size - Positive for pages, negative for kilobytes.
     * @returns {this}
     */
    public cacheSize(size: number): this {
        this._statements.push(`PRAGMA cache_size = ${size};`);
        return this;
    }

    /**
     * @function tempStore
     * @description Sets where temporary tables/indexes are stored.
     * @param {'DEFAULT' | 'FILE' | 'MEMORY'} location
     * @returns {this}
     */
    public tempStore(location: 'DEFAULT' | 'FILE' | 'MEMORY'): this {
        this._statements.push(`PRAGMA temp_store = ${location};`);
        return this;
    }

    /**
     * @function raw
     * @description Adds a custom PRAGMA statement.
     * @param {string} key
     * @param {string | number} value
     * @returns {this}
     */
    public raw(key: string, value: string | number): this {
        this._statements.push(`PRAGMA ${key} = ${value};`);
        return this;
    }

    /**
     * @function busyTimeout
     * @description Sets the timeout (ms) for busy handlers before returning SQLITE_BUSY.
     * @param {number} ms
     * @returns {this}
     */
    public busyTimeout(ms: number): this {
        this._statements.push(`PRAGMA busy_timeout = ${ms};`);
        return this;
    }

    /**
     * @function mmap_size
     * @description Sets the mmap limit (bytes) for memory-mapped I/O.
     * @param {number} bytes
     * @returns {this}
     */
    public mmap_size(bytes: number): this {
        this._statements.push(`PRAGMA mmap_size = ${bytes};`);
        return this;
    }

    /**
     * @function pageSize
     * @description Sets the database page size (must be power of 2 between 512 and 65536).
     * @param {number} bytes
     * @returns {this}
     */
    public pageSize(bytes: number): this {
        this._statements.push(`PRAGMA page_size = ${bytes};`);
        return this;
    }

    /**
     * @function autoVacuum
     * @description Sets the auto-vacuum mode.
     * @param {'NONE' | 'FULL' | 'INCREMENTAL'} mode
     * @returns {this}
     */
    public autoVacuum(mode: 'NONE' | 'FULL' | 'INCREMENTAL'): this {
        this._statements.push(`PRAGMA auto_vacuum = ${mode};`);
        return this;
    }

    /**
     * @function optimize
     * @description Runs the query planner optimization (should be called before closing).
     * @returns {this}
     */
    public optimize(): this {
        this._statements.push(`PRAGMA optimize;`);
        return this;
    }

    /**
     * @function build
     * @description Compiles the pragma statements into a single SQL string.
     * @returns {string} Combined PRAGMA statements.
     */
    public build(): string {
        return this._statements.join('\n');
    }
}
