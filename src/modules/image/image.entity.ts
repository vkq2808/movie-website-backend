import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { modelNames } from '@/common/constants/model-name.constant';

export enum ResourceType {
  IMAGE = 'image',
  RAW = 'raw',
  VIDEO = 'video',
  AUTO = 'auto',
}

@Entity({ name: modelNames.IMAGE })
export class Image {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  url: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  alt: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  width: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  height: number;

  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  bytes: number;

  @Column({ type: 'enum', enum: ResourceType, default: ResourceType.IMAGE, })
  @IsEnum(ResourceType)
  resource_type: ResourceType;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
