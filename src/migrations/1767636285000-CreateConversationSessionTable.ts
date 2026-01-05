import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateConversationSessionTable1767636285000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'conversation_session',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'language',
            type: 'varchar',
            length: '10',
            default: "'vi'",
          },
          {
            name: 'messageHistory',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'suggestedMovieIds',
            type: 'varchar',
            isArray: true,
            default: "'{}'",
          },
          {
            name: 'preferences',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'lastIntent',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'NOW()',
            onUpdate: 'NOW()',
          },
        ],
        indices: [
          {
            name: 'IDX_CONVERSATION_SESSION_USER_ID',
            columnNames: ['userId'],
          },
          {
            name: 'IDX_CONVERSATION_SESSION_CREATED_AT',
            columnNames: ['createdAt'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('conversation_session');
  }
}
