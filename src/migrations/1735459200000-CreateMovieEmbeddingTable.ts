import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMovieEmbeddingTable1735459200000
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'movie_embedding',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'movie_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'embedding',
            type: 'text',
            isNullable: false,
            comment: 'Text embedding vector from OpenAI (stored as comma-separated string)',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
            comment:
              'Normalized movie content (title, genres, overview, cast, etc.)',
          },
          {
            name: 'model',
            type: 'varchar',
            length: '100',
            isNullable: false,
            default: "'text-embedding-3-large'",
          },
          {
            name: 'embedding_dimension',
            type: 'int',
            isNullable: false,
            default: 3072,
            comment: 'Dimension of the embedding vector',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['movie_id'],
            referencedTableName: 'movie',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'movie_embedding',
      new TableIndex({
        name: 'idx_movie_embedding_movie_id',
        columnNames: ['movie_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'movie_embedding',
      new TableIndex({
        name: 'idx_movie_embedding_created_at',
        columnNames: ['created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('movie_embedding', true);
  }
}
