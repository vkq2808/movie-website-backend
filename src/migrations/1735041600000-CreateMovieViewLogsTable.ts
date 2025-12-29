import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMovieViewLogsTable1735041600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'movie_view_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'movie_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'viewed_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            columnNames: ['user_id', 'movie_id'],
            isUnique: false,
          },
          {
            columnNames: ['movie_id'],
            isUnique: false,
          },
          {
            columnNames: ['user_id'],
            isUnique: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user',
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['movie_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'movie',
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('movie_view_logs', true);
  }
}
