import { AppDataSource } from '@/database/data-source';
AppDataSource.initialize()
  .then(async () => {
    console.log('📦 Running migrations...');
    await AppDataSource.runMigrations();
    console.log('✅ Migrations complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
