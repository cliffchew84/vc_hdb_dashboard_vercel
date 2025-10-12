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
const TOTAL_MONTHS_TO_FETCH = 12;
const API_DELAY_MS = 150; // Delay between API calls to be respectful to the server

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
    try {
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
        
        for (let i = TOTAL_MONTHS_TO_FETCH - 1; i >= 0; i--) {
            const targetDate = new Date(latestDate.getFullYear(), latestDate.getMonth() - i, 1);
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const monthString = `${year}-${month}`;
            
            try {
                const filters = encodeURIComponent(JSON.stringify({ month: monthString }));
                const fields = "month,resale_price,flat_type,town,floor_area_sqm,remaining_lease";
                const url = `${BASE_URL}?resource_id=${DATASET_ID}&filters=${filters}&limit=10000&fields=${fields}`;

                const response = await fetch(url);
                if (!response.ok) {
                  console.warn(`Could not fetch data for ${monthString}. Status: ${response.status}`);
                  continue;
                }
                
                const apiData = await response.json() as SgGovApiResponse;
                
                if (apiData.success && apiData.result.records.length > 0) {
                  allFetchedRecords.push(...apiData.result.records);
                } else {
                  console.warn(`No records found for ${monthString}.`);
                }
            } catch (monthError) {
                console.error(`An error occurred while fetching data for ${monthString}:`, monthError);
            }

            if (i > 0) {
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
