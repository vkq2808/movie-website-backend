import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DirectorController } from "./director.controller";
import { DirectorService } from "./director.service";
import { Director } from "./director.entity";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Director]),
  ],
  controllers: [DirectorController],
  providers: [DirectorService]
})
export class DirectorModule { }