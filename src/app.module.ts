import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbProvidermodule } from './dbprovider/dbprovider.module';

@Module({
  imports: [DbProvidermodule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
