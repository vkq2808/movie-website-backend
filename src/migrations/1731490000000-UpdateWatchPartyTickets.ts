import { MigrationInterface, QueryRunner } from 'typeorm';

const schema = process.env.DB_SCHEMA || 'public';
const ticketTable = `"${schema}"."ticket"`;
const ticketPurchaseTable = `"${schema}"."ticket_purchase"`;
const watchPartyTable = `"${schema}"."watch_party"`;

export class UpdateWatchPartyTickets1731490000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure watch_party_id column exists on ticket table
    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      ADD COLUMN IF NOT EXISTS watch_party_id uuid
    `);

    // Clean up legacy columns no longer in use
    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      DROP COLUMN IF EXISTS name,
      DROP COLUMN IF EXISTS is_voucher
    `);

    // Align price column precision
    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      ALTER COLUMN price TYPE numeric(10, 2)
    `);

    // Make watch_party_id required and set up relation
    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      ALTER COLUMN watch_party_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      ADD CONSTRAINT IF NOT EXISTS uq_ticket_watch_party UNIQUE (watch_party_id)
    `);

    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      ADD CONSTRAINT IF NOT EXISTS fk_ticket_watch_party
        FOREIGN KEY (watch_party_id)
        REFERENCES ${watchPartyTable}(id)
        ON DELETE CASCADE
    `);

    // Update ticket_purchase table
    await queryRunner.query(`
      ALTER TABLE ${ticketPurchaseTable}
      DROP COLUMN IF EXISTS purchase_date
    `);

    await queryRunner.query(`
      ALTER TABLE ${ticketPurchaseTable}
      ADD CONSTRAINT IF NOT EXISTS uq_ticket_purchase_user_party
        UNIQUE (user_id, watch_party_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert ticket_purchase changes
    await queryRunner.query(`
      ALTER TABLE ${ticketPurchaseTable}
      DROP CONSTRAINT IF EXISTS uq_ticket_purchase_user_party
    `);

    await queryRunner.query(`
      ALTER TABLE ${ticketPurchaseTable}
      ADD COLUMN IF NOT EXISTS purchase_date timestamp DEFAULT CURRENT_TIMESTAMP
    `);

    // Revert ticket table relation updates
    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      DROP CONSTRAINT IF EXISTS fk_ticket_watch_party
    `);

    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      DROP CONSTRAINT IF EXISTS uq_ticket_watch_party
    `);

    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      ALTER COLUMN watch_party_id DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      ADD COLUMN IF NOT EXISTS name varchar
    `);

    await queryRunner.query(`
      ALTER TABLE ${ticketTable}
      ADD COLUMN IF NOT EXISTS is_voucher boolean DEFAULT false
    `);
  }
}
