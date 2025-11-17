import { MigrationInterface, QueryRunner } from 'typeorm';

export class CopyKeyToUrlAndDropKeyColumn1761969401713
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ✅ Đảm bảo cột 'url' tồn tại trước khi sao chép
    await queryRunner.query(`
      ALTER TABLE "${process.env.DB_SCHEMA || 'public'}"."video"
      ADD COLUMN IF NOT EXISTS url text;
    `);

    // 1️⃣ Sao chép dữ liệu từ cột key sang url (nếu url hiện đang null)
    await queryRunner.query(`
      UPDATE "${process.env.DB_SCHEMA || 'public'}"."video"
      SET url = key
      WHERE (url IS NULL OR url = '') AND key IS NOT NULL;
    `);

    // 2️⃣ Xóa cột key
    await queryRunner.query(`
      ALTER TABLE "${process.env.DB_SCHEMA || 'public'}"."video"
      DROP COLUMN IF EXISTS key;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1️⃣ Thêm lại cột key (nullable để rollback không lỗi)
    await queryRunner.query(`
      ALTER TABLE "${process.env.DB_SCHEMA || 'public'}"."video"
      ADD COLUMN key text;
    `);

    // 2️⃣ Sao chép ngược lại từ url sang key (nếu rollback)
    await queryRunner.query(`
      UPDATE "${process.env.DB_SCHEMA || 'public'}"."video"
      SET key = url
      WHERE url IS NOT NULL;
    `);
  }
}
