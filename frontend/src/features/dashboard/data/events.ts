export interface RecessionPeriod {
  name: string;
  startDate: string;
  endDate: string;
}

export interface KeyEvent {
  date: string;
  label: string;
  type: 'market_event' | 'geopolitical_shock' | 'policy_change' | 'financial_crisis' | 'fiscal_policy' | 'global_shock';
}

export const recessionPeriods: RecessionPeriod[] = [
  {
    name: 'Dot-com Bust',
    startDate: '2001-03-01',
    endDate: '2001-11-01',
  },
  {
    name: 'Great Recession',
    startDate: '2007-12-01',
    endDate: '2009-06-01',
  },
  {
    name: 'COVID-19 Recession',
    startDate: '2020-02-01',
    endDate: '2020-04-01',
  },
];

export const keyEvents: KeyEvent[] = [
  // --- The Dot-Com Era & Aftermath ---
  {
    date: '2000-03-10',
    label: 'Dot-Com Bubble Peaks (NASDAQ Composite hits all-time high)',
    type: 'market_event',
  },
  {
    date: '2001-09-11',
    label: '9/11 Terrorist Attacks (Markets closed for a week)',
    type: 'geopolitical_shock',
  },

  // --- The Build-Up to the Global Financial Crisis ---
  {
    date: '2004-06-30',
    label: 'Federal Reserve Begins Rate Hike Cycle (Greenspan/Bernanke)',
    type: 'policy_change',
  },
  {
    date: '2006-06-29',
    label: 'Fed Pauses Rate Hikes at 5.25% (End of tightening cycle)',
    type: 'policy_change',
  },
  {
    date: '2007-06-01',
    label: 'Bear Stearns Hedge Funds Collapse (First major sign of subprime crisis)',
    type: 'financial_crisis',
  },

  // --- The Global Financial Crisis (GFC) ---
  {
    date: '2008-09-15',
    label: 'Lehman Brothers Files for Bankruptcy',
    type: 'financial_crisis',
  },
  {
    date: '2008-10-03',
    label: 'Troubled Asset Relief Program (TARP) Signed into Law',
    type: 'fiscal_policy',
  },
  {
    date: '2008-12-16',
    label: 'Federal Reserve Cuts Rates to Zero (ZIRP)',
    type: 'policy_change',
  },
  {
    date: '2009-03-18',
    label: 'Fed Announces Major Expansion of Quantitative Easing (QE1)',
    type: 'policy_change',
  },

  // --- The Post-GFC Recovery Era ---
  {
    date: '2010-05-02',
    label: 'First Greek Bailout (Peak of European Sovereign Debt Crisis)',
    type: 'global_shock',
  },
  {
    date: '2013-05-22',
    label: '"Taper Tantrum" Begins (Markets react to potential end of QE)',
    type: 'market_event',
  },
  {
    date: '2014-10-29',
    label: 'Federal Reserve Ends Quantitative Easing Program',
    type: 'policy_change',
  },
  {
    date: '2015-12-16',
    label: 'First Post-GFC Rate Hike ("Liftoff")',
    type: 'policy_change',
  },
  {
    date: '2017-12-22',
    label: 'Tax Cuts and Jobs Act of 2017 Signed',
    type: 'fiscal_policy',
  },

  // --- The COVID-19 Era ---
  {
    date: '2020-03-11',
    label: 'WHO Declares COVID-19 a Global Pandemic',
    type: 'global_shock',
  },
  {
    date: '2020-03-15',
    label: 'Federal Reserve Emergency Cuts Rates Back to Zero',
    type: 'policy_change',
  },
  {
    date: '2020-03-27',
    label: 'CARES Act Signed (First major COVID-19 fiscal stimulus)',
    type: 'fiscal_policy',
  },

  // --- The Inflation & Modern Policy Era ---
  {
    date: '2021-06-01',
    label: 'CPI Inflation Surpasses 5% Year-over-Year',
    type: 'market_event',
  },
  {
    date: '2022-03-16',
    label: 'Federal Reserve Begins Aggressive Rate Hike Cycle to Fight Inflation',
    type: 'policy_change',
  },
  {
    date: '2023-03-10',
    label: 'Silicon Valley Bank (SVB) Fails',
    type: 'financial_crisis',
  },
];
