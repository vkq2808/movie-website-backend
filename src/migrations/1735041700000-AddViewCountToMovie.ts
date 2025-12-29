import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddViewCountToMovie1735041700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'movie',
      new TableColumn({
        name: 'view_count',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('movie', 'view_count');
  }
}
