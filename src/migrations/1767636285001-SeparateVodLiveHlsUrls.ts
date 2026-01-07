import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SeparateVodLiveHlsUrls1767636285001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns for separate VOD and LIVE HLS URLs
    await queryRunner.addColumns('video', [
      new TableColumn({
        name: 'hls_vod_url',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'hls_live_url',
        type: 'text',
        isNullable: true,
      }),
    ]);

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_video_hls_vod_url ON video(hls_vod_url);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_video_hls_live_url ON video(hls_live_url);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_video_hls_vod_url;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_video_hls_live_url;
    `);

    // Remove columns
    await queryRunner.dropColumns('video', ['hls_vod_url', 'hls_live_url']);
  }
}
