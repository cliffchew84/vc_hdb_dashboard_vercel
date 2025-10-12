import { HdbResaleRecord } from '../types.ts';

/**
 * Fetches all HDB resale data from our serverless API endpoint.
 * This endpoint handles fetching from the external API and provides caching.
 * @returns A promise that resolves to an array of all fetched records.
 */
export const fetchAllHdbData = async (): Promise<HdbResaleRecord[]> => {
    const response = await fetch('/api/getHdbData');
    
    if (!response.ok) {
        // Try to parse the error message from the serverless function's response
        const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred while fetching data.' }));
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
    }
    
    const data: HdbResaleRecord[] = await response.json();
    return data;
};
