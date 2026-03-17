import { describe, expect, it } from 'vitest';
import { contractDef } from '../src/cli-contract-validator.js';
import { CZVO } from '../src/cli-types.js';

describe('CliContract Validation', () => {
    it('should validate a correct hybrid contract', () => {
        const cli = contractDef({
            name: "ytn",
            description: "YT Downloader",
            def: {
                input_path: { type: "filepath", description: "Path to input file" },
                retry_count: { type: CZVO.number().min(1).max(5), description: "Retries" },
                tags: { type: CZVO.list(CZVO.string()), description: "Tags list" }
            },
            targets: {
                sync: {
                    description: "Sync files",
                    positionals: ["input_path"],
                    flags: { retry_count: 3 }
                }
            }
        });
        
        expect(cli.raw.name).toBe("ytn");
        expect(cli.raw.def.input_path.type).toBe("filepath");
    });

    it('should throw on unknown string type', () => {
        expect(() => {
            contractDef({
                name: "err",
                description: "err",
                def: {
                    user_age: { type: "bolean", description: "typo here" } as any
                },
                targets: {}
            });
        }).toThrow();
    });

    it('should translate string types to pure Zod schemas via .enhanced', () => {
        const cli = contractDef({
            name: "test",
            description: "test",
            def: {
                age: { type: "number | email", description: "Age" }
            },
            targets: {}
        });
        
        const enhanced = cli.enhanced;
        const typeSchema = (enhanced.def.age.type as any);
        
        // The type should now be a pure Zod schema
        expect(typeof typeSchema).toBe("object");
        expect('_zod' in typeSchema).toBe(true);
    });

    it('should generate structured help data via .help()', () => {
        const cli = contractDef({
            name: "ytn",
            description: "YT Downloader",
            def: {
                url: { type: "url", description: "Video URL", arg_name: "video_url" },
                quality: { type: "number", description: "Video quality", flags: { long: "quality", short: "q" } }
            },
            targets: {
                dl: { 
                    description: "Download a video",
                    positionals: ["url"],
                    flags: { quality: { optional: true } }
                }
            }
        });

        const help = cli.help();
        expect(help.name).toBe("ytn");
        expect(help.usage_cases[0].command).toBe("ytn dl <video_url> [--quality]");
        expect(help.arguments.find(a => a.name === "quality")?.usages).toContain("--quality");
    });
});
