import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrgmIndexToKeywordName1739851234567 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_keyword_name_trgm
      ON "keyword"
      USING gin (name gin_trgm_ops);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_keyword_name_trgm;`);
  }
}
