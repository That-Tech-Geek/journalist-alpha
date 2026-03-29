'use server';

import yahooFinance from 'yahoo-finance2';

export async function getHistoricalStockData({ symbol, from, to }: { symbol: string, from: string, to: string }) {
  try {
    const queryOptions = { period1: from, period2: to };
    const result = await yahooFinance.historical(symbol, queryOptions) as any[];
    
    // Simplify the data to reduce token usage
    const simplified = result.map((day: any) => ({
      date: day.date.toISOString().split('T')[0],
      close: day.close,
      volume: day.volume
    }));
    
    return JSON.stringify(simplified);
  } catch (error: any) {
    console.error("Error fetching historical data:", error);
    return JSON.stringify({ error: error.message });
  }
}

export async function getStockQuote({ symbol }: { symbol: string }) {
  try {
    const result = await yahooFinance.quote(symbol) as any;
    
    // Extract only the most relevant fields
    const simplified = {
      symbol: result.symbol,
      shortName: result.shortName,
      regularMarketPrice: result.regularMarketPrice,
      regularMarketChangePercent: result.regularMarketChangePercent,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow,
      marketCap: result.marketCap,
      trailingPE: result.trailingPE,
      forwardPE: result.forwardPE,
      dividendYield: result.dividendYield
    };
    
    return JSON.stringify(simplified);
  } catch (error: any) {
    console.error("Error fetching quote:", error);
    return JSON.stringify({ error: error.message });
  }
}
