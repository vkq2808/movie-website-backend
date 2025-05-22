import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { IsNotEmpty, IsString } from "class-validator";
import { modelNames } from "@/common/constants/model-name.constant";

@Entity({ name: modelNames.TOPIC_MODEL_NAME })
export class Topic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  iso_639_1: string;

  @Column()
  @IsNotEmpty()
  @IsString()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}