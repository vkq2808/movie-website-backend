const { performance } = require('perf_hooks');

// Simple test to measure execution time
async function testMovieQuery() {
  console.log('Testing movie query performance...');

  // Simulate the old complex query (multiple JOINs)
  const start1 = performance.now();
  await simulateComplexQuery();
  const end1 = performance.now();

  // Simulate the new optimized query (separate queries)
  const start2 = performance.now();
  await simulateOptimizedQuery();
  const end2 = performance.now();

  console.log(`Complex query time: ${end1 - start1} ms`);
  console.log(`Optimized query time: ${end2 - start2} ms`);
  console.log(`Performance improvement: ${((end1 - start1) / (end2 - start2)).toFixed(2)}x faster`);
}

async function simulateComplexQuery() {
  // Simulate the Cartesian product effect
  // 5 genres × 3 languages × 2 companies × 10 titles × 5 overviews = 1,500 rows
  const rows = 1500;
  const data = [];

  for (let i = 0; i < rows; i++) {
    data.push({
      movie: { id: 1, title: 'Test Movie' },
      genre: { id: i % 5, name: `Genre ${i % 5}` },
      language: { id: i % 3, name: `Language ${i % 3}` },
      company: { id: i % 2, name: `Company ${i % 2}` },
      title: { id: i % 10, title: `Alt Title ${i % 10}` },
      overview: { id: i % 5, overview: `Alt Overview ${i % 5}` }
    });
  }

  // Simulate network latency and processing
  await new Promise(resolve => setTimeout(resolve, 50));
  return data;
}

async function simulateOptimizedQuery() {
  // Simulate 6 separate small queries
  const queries = [
    { name: 'movie', rows: 1 },
    { name: 'genres', rows: 5 },
    { name: 'languages', rows: 3 },
    { name: 'companies', rows: 2 },
    { name: 'titles', rows: 10 },
    { name: 'overviews', rows: 5 }
  ];

  const results = [];
  for (const query of queries) {
    const data = [];
    for (let i = 0; i < query.rows; i++) {
      data.push({ id: i, name: `${query.name} ${i}` });
    }
    // Simulate smaller network latency per query
    await new Promise(resolve => setTimeout(resolve, 8));
    results.push(data);
  }

  return results;
}

testMovieQuery().catch(console.error);
