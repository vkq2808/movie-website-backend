// Initial production companies data for seeding the database
// Based on popular and well-known film production companies

export const INITIAL_PRODUCTION_COMPANIES = [
  {
    name: 'Marvel Studios',
    description:
      'American film and television production company owned by The Walt Disney Company',
    homepage: 'https://www.marvel.com/studios',
    headquarters: 'Burbank, California, United States',
    origin_country: 'US',
    parent_company: 'The Walt Disney Company',
    original_id: "420",
    logo_url:
      'https://image.tmdb.org/t/p/original/hUzeosd33nzE5MCNsZxCGEKTXaQ.png',
    priority: 100,
  },
  {
    name: 'Walt Disney Pictures',
    description:
      'American film production company and subsidiary of The Walt Disney Studios',
    homepage: 'https://studios.disney.com/walt-disney-pictures',
    headquarters: 'Burbank, California, United States',
    origin_country: 'US',
    parent_company: 'The Walt Disney Company',
    original_id: "2",
    logo_url:
      'https://image.tmdb.org/t/p/original/wdrCwmRnLFJhEoH8GSfymY85KHT.png',
    priority: 95,
  },
  {
    name: 'Warner Bros. Pictures',
    description: 'American film production and distribution company',
    homepage: 'https://www.warnerbros.com',
    headquarters: 'Burbank, California, United States',
    origin_country: 'US',
    parent_company: 'Warner Bros. Discovery',
    original_id: "174",
    logo_url:
      'https://image.tmdb.org/t/p/original/zhD3hhtKB5qyv7ZeL4uLpNxgMVU.png',
    priority: 90,
  },
  {
    name: 'Universal Pictures',
    description: 'American film production and distribution company',
    homepage: 'https://www.universalstudios.com',
    headquarters: 'Universal City, California, United States',
    origin_country: 'US',
    parent_company: 'NBCUniversal',
    original_id: "33",
    logo_url:
      'https://image.tmdb.org/t/p/original/8lvHyhjr8oUKOOy2dKXoALWKdp0.png',
    priority: 85,
  },
  {
    name: 'Sony Pictures',
    description:
      'American diversified multinational mass media and entertainment studio conglomerate',
    homepage: 'https://www.sonypictures.com',
    headquarters: 'Culver City, California, United States',
    origin_country: 'US',
    parent_company: 'Sony',
    original_id: "5",
    logo_url:
      'https://image.tmdb.org/t/p/original/71BqEFAF4V3qjjMPCpLuyJFB9A.png',
    priority: 80,
  },
  {
    name: 'Paramount Pictures',
    description:
      'American film and television production and distribution company',
    homepage: 'https://www.paramount.com',
    headquarters: 'Hollywood, California, United States',
    origin_country: 'US',
    parent_company: 'Paramount Global',
    original_id: "4",
    logo_url:
      'https://image.tmdb.org/t/p/original/fycMZt242LVjagMByZOLUGbCvv3.png',
    priority: 75,
  },
  {
    name: '20th Century Studios',
    description:
      'American film production company owned by The Walt Disney Company',
    homepage: 'https://www.20thcenturystudios.com',
    headquarters: 'Los Angeles, California, United States',
    origin_country: 'US',
    parent_company: 'The Walt Disney Company',
    original_id: "25",
    logo_url:
      'https://image.tmdb.org/t/p/original/qZCc1lty5FzX30aOCVRBLzaVmcp.png',
    priority: 70,
  },
];

// Helper function to get production company by name
export function getProductionCompanyByName(name: string) {
  return INITIAL_PRODUCTION_COMPANIES.find(
    (company) => company.name.toLowerCase() === name.toLowerCase(),
  );
}

// Helper function to get production companies by country
export function getProductionCompaniesByCountry(country: string) {
  return INITIAL_PRODUCTION_COMPANIES.filter(
    (company) => company.origin_country === country,
  );
}

// Helper function to get top production companies by priority
export function getTopProductionCompanies(limit: number = 10) {
  return INITIAL_PRODUCTION_COMPANIES.sort(
    (a, b) => b.priority - a.priority,
  ).slice(0, limit);
}
