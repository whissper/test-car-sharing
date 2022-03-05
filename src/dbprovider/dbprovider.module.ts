import { Module } from "@nestjs/common";
import { DbProviderService } from './dbprovider.service';

@Module({
    providers: [DbProviderService],
    exports: [DbProviderService]
})
export class DbProvidermodule {}