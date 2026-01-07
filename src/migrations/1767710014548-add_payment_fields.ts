import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPaymentFields1767710014548 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'payment',
      new TableColumn({
        name: 'currency',
        type: 'varchar',
        length: '10',
        default: "'VND'",
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'payment',
      new TableColumn({
        name: 'payment_url',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'payment',
      new TableColumn({
        name: 'vnp_transaction_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'payment',
      new TableColumn({
        name: 'vnp_order_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'payment',
      new TableColumn({
        name: 'ipn_url',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('payment', 'currency');
    await queryRunner.dropColumn('payment', 'payment_url');
    await queryRunner.dropColumn('payment', 'vnp_transaction_id');
    await queryRunner.dropColumn('payment', 'vnp_order_id');
    await queryRunner.dropColumn('payment', 'ipn_url');
  }
}
