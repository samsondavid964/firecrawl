import { batchScrape, crawl, creditUsage, extract, map, scrape, search, tokenUsage } from "./lib";

const sleep = (ms: number) => new Promise(x => setTimeout(() => x(true), ms));
const sleepForBatchBilling = () => sleep(40000);

beforeAll(async () => {
    // Wait for previous test runs to stop billing processing
    if (!process.env.TEST_SUITE_SELF_HOSTED) {
        await sleep(40000);
    }
}, 50000);

describe("Billing tests", () => {
    if (process.env.TEST_SUITE_SELF_HOSTED) {
        it("dummy", () => {
            expect(true).toBe(true);
        });
    } else {
        it("bills scrape correctly", async () => {
            const rc1 = (await creditUsage()).remaining_credits;
            
            // Run all scrape operations in parallel with Promise.all
            const [scrape1, scrape2, scrape3] = await Promise.all([
                // scrape 1: regular fc.dev scrape (1 credit)
                scrape({
                    url: "https://firecrawl.dev"
                }),
                
                // scrape 1.1: regular fc.dev scrape (1 credit)
                scrape({
                    url: "https://firecrawl.dev"
                }),
                
                // scrape 2: fc.dev with json (5 credits)
                scrape({
                    url: "https://firecrawl.dev",
                    formats: ["json"],
                    jsonOptions: {
                        schema: {
                            type: "object",
                            properties: {
                                is_open_source: { type: "boolean" },
                            },
                            required: ["is_open_source"],
                        },
                    },
                })
            ]);

            expect(scrape1.metadata.creditsUsed).toBe(1);
            expect(scrape2.metadata.creditsUsed).toBe(1);
            expect(scrape3.metadata.creditsUsed).toBe(5);
            
            // sum: 7 credits

            await sleepForBatchBilling();

            const rc2 = (await creditUsage()).remaining_credits;

            expect(rc1 - rc2).toBe(7);
        }, 120000);

        it("bills batch scrape correctly", async () => {
            const rc1 = (await creditUsage()).remaining_credits;
            
            // Run both scrape operations in parallel with Promise.all
            const [scrape1, scrape2] = await Promise.all([
                // scrape 1: regular batch scrape with failing domain (2 credits)
                batchScrape({
                    urls: [
                        "https://firecrawl.dev",
                        "https://mendable.ai",
                        "https://thisdomaindoesnotexistandwillfail.fcr",
                    ],
                }),
                
                // scrape 2: batch scrape with json (10 credits)
                batchScrape({
                    urls: [
                        "https://firecrawl.dev",
                        "https://mendable.ai",
                        "https://thisdomaindoesnotexistandwillfail.fcr",
                    ],
                    formats: ["json"],
                    jsonOptions: {
                        schema: {
                            type: "object",
                            properties: {
                                four_word_summary: { type: "string" },
                            },
                            required: ["four_word_summary"],
                        },
                    },
                })
            ]);

            expect(scrape1.data[0].metadata.creditsUsed).toBe(1);
            expect(scrape1.data[1].metadata.creditsUsed).toBe(1);

            expect(scrape2.data[0].metadata.creditsUsed).toBe(5);
            expect(scrape2.data[1].metadata.creditsUsed).toBe(5);
            
            // sum: 12 credits

            await sleepForBatchBilling();

            const rc2 = (await creditUsage()).remaining_credits;

            expect(rc1 - rc2).toBe(12);
        }, 600000);

        it("bills crawl correctly", async () => {
            const rc1 = (await creditUsage()).remaining_credits;
            
            // Run both crawl operations in parallel with Promise.all
            const [crawl1, crawl2] = await Promise.all([
                // crawl 1: regular fc.dev crawl (x credits)
                crawl({
                    url: "https://firecrawl.dev",
                    limit: 10,
                }),
                
                // crawl 2: fc.dev crawl with json (5y credits)
                crawl({
                    url: "https://firecrawl.dev",
                    scrapeOptions: {
                        formats: ["json"],
                        jsonOptions: {
                            schema: {
                                type: "object",
                                properties: {
                                    four_word_summary: { type: "string" },
                                },
                                required: ["four_word_summary"],
                            },
                        },
                    },
                    limit: 10,
                })
            ]);
            
            expect(crawl1.success).toBe(true);
            expect(crawl2.success).toBe(true);
            
            // sum: x+5y credits

            await sleepForBatchBilling();

            const rc2 = (await creditUsage()).remaining_credits;

            if (crawl1.success && crawl2.success) {
                expect(rc1 - rc2).toBe(crawl1.completed + crawl2.completed * 5);
            }
        }, 600000);

        it("bills map correctly", async () => {
            const rc1 = (await creditUsage()).remaining_credits;
            await map({ url: "https://firecrawl.dev" });
            await sleepForBatchBilling();
            const rc2 = (await creditUsage()).remaining_credits;
            expect(rc1 - rc2).toBe(1);
        }, 60000);

        it("bills search correctly", async () => {
            const rc1 = (await creditUsage()).remaining_credits;

            const results = await search({
                query: "firecrawl"
            });

            await sleepForBatchBilling();

            const rc2 = (await creditUsage()).remaining_credits;

            expect(rc1 - rc2).toBe(results.length);
        }, 60000);

        it("bills search with scrape correctly", async () => {
            const rc1 = (await creditUsage()).remaining_credits;

            const results = await search({
                query: "firecrawl",
                scrapeOptions: {
                    formats: ["markdown"],
                },
            });

            await sleepForBatchBilling();

            const rc2 = (await creditUsage()).remaining_credits;

            expect(rc1 - rc2).toBe(results.length);
        }, 600000);

        it("bills extract correctly", async () => {
            const rc1 = (await tokenUsage()).remaining_tokens;
            
            const extractResult = await extract({
                urls: ["https://firecrawl.dev"],
                schema: {
                    "type": "object",
                    "properties": {
                        "is_open_source": {
                            "type": "boolean"
                        }
                    },
                    "required": [
                        "is_open_source"
                    ]
                },
                origin: "api-sdk",
            });

            expect(extractResult.tokensUsed).toBe(305);

            await sleepForBatchBilling();
            
            const rc2 = (await tokenUsage()).remaining_tokens;

            expect(rc1 - rc2).toBe(305);
        }, 300000);
    }
});
