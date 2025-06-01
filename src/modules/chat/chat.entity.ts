import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { IsNotEmpty, IsString } from "class-validator";
import { User } from "../auth/user.entity";
import { modelNames } from "@/common/constants/model-name.constant";

@Entity({ name: modelNames.CHAT_MODEL_NAME })
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @IsNotEmpty({ message: 'SenderId is required' })
  sender: User;

  @ManyToOne(() => User)
  @IsNotEmpty({ message: 'ReceiverId is required' })
  receiver: User;
  @Column({ type: 'text' })
  @IsNotEmpty()
  @IsString()
  message: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}