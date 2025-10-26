import { MigrationInterface, QueryRunner } from 'typeorm';

export class CopyEnglishNameToName1729500000000 implements MigrationInterface {
  name = 'CopyEnglishNameToName1729500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ✅ Cập nhật dữ liệu: copy english_name -> name
    await queryRunner.query(`
      UPDATE "language"
      SET "name" = "english_name"
      WHERE "english_name" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 🔄 Nếu rollback, có thể xóa name hoặc khôi phục null
    await queryRunner.query(`
      UPDATE "language"
      SET "name" = NULL
    `);
  }
}
