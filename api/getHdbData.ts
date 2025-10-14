import type { VercelRequest, VercelResponse } from '@vercel/node';

// Duplicated types to make the function self-contained and avoid build issues.
interface HdbResaleRecord {
  month: string;
  town: string;
  flat_type: string;
  resale_price: string;
  floor_area_sqm?: string;
  remaining_lease?: string;
  _id?: number;
}

interface SgGovApiResponse {
  success: boolean;
  result: {
    records: HdbResaleRecord[];
    [key: string]: any;
  };
}


const DATASET_ID = "f1765b54-a209-4718-8d38-a39237f502b3";
const BASE_URL = "https://data.gov.sg/api/action/datastore_search";
const TOTAL_MONTHS_TO_FETCH = 24; // Fetch 2 years of data
const CHUNK_SIZE = 4; // Fetch in chunks of 4 months
const API_DELAY_MS = 200; // Delay between chunks to be respectful to the server

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
    try {
        // First, fetch the single latest record to determine the most recent month of data available.
        const latestRecordUrl = `${BASE_URL}?resource_id=${DATASET_ID}&limit=1&sort=_id%20desc&fields=month`;
        const latestRecordResponse = await fetch(latestRecordUrl);
        if (!latestRecordResponse.ok) {
            throw new Error(`Failed to fetch latest record: ${latestRecordResponse.statusText}`);
        }
        const latestRecordData = await latestRecordResponse.json() as SgGovApiResponse;
        const latestMonthString = latestRecordData.result.records[0]?.month;

        if (!latestMonthString) {
            throw new Error('Could not determine the latest available month from the API.');
        }

        const [latestYear, latestMonth] = latestMonthString.split('-').map(Number);
        const latestDate = new Date(latestYear, latestMonth - 1, 1);
        
        const allFetchedRecords: HdbResaleRecord[] = [];
        
        // Generate a list of all month strings to be fetched (e.g., "2024-07", "2024-06", ...)
        const monthsToFetch: string[] = [];
        for (let i = 0; i < TOTAL_MONTHS_TO_FETCH; i++) {
            const targetDate = new Date(latestDate.getFullYear(), latestDate.getMonth() - i, 1);
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            monthsToFetch.push(`${year}-${month}`);
        }

        // Process the months in concurrent chunks
        for (let i = 0; i < monthsToFetch.length; i += CHUNK_SIZE) {
            const chunk = monthsToFetch.slice(i, i + CHUNK_SIZE);

            // Create an array of fetch promises for the current chunk
            const promises = chunk.map(monthString => {
                const filters = encodeURIComponent(JSON.stringify({ month: monthString }));
                const fields = "month,resale_price,flat_type,town,floor_area_sqm,remaining_lease";
                const url = `${BASE_URL}?resource_id=${DATASET_ID}&filters=${filters}&limit=10000&fields=${fields}`;

                return fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            console.warn(`Could not fetch data for ${monthString}. Status: ${response.status}`);
                            return null; // Return null for failed requests to not break Promise.all
                        }
                        return response.json() as Promise<SgGovApiResponse>;
                    })
                    .catch(monthError => {
                        console.error(`An error occurred while fetching data for ${monthString}:`, monthError);
                        return null; // Return null on network error
                    });
            });
            
            // Wait for all fetches in the current chunk to complete
            const chunkResults = await Promise.all(promises);

            // Process the results from the chunk
            for (const apiData of chunkResults) {
                if (apiData && apiData.success && apiData.result.records.length > 0) {
                    allFetchedRecords.push(...apiData.result.records);
                }
            }

            // If there are more chunks to process, wait for a short period
            if (i + CHUNK_SIZE < monthsToFetch.length) {
                await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
            }
        }
        
        // Set Vercel Edge Cache to cache the response for 24 hours.
        // `s-maxage` is for shared caches (like Vercel's), and `stale-while-revalidate`
        // allows serving a cached response while fetching a fresh one in the background.
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
        res.status(200).json(allFetchedRecords);

    } catch (error) {
        console.error('Error in getHdbData serverless function:', error);
        const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
        res.status(500).json({ success: false, error: message });
    }
}