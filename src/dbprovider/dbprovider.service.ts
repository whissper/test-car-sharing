import { Injectable } from "@nestjs/common";
import { Client } from 'pg';

@Injectable()
export class DbProviderService {

    private readonly connectionConfig = {
        user: 'postgres',
        password: '123',
        host: 'localhost',
        database: 'postgres',
        port: 5432,
    };

    /**
     * Прямой запрос в БД
     * @param {string} queryString строка запроса
     * @returns {Promise<{ rows: Array<any> }>} массив строк в качестве ответа на запрос
     */
    async makeQuery(queryString: string): Promise<{ rows: Array<any>; command: string }> {
        let result = { rows: [], command: '' };

        const client = new Client(this.connectionConfig);

        try {
            await client.connect();
            result = await client.query(queryString);
            await client.end();
        } catch (error) {
            await client.end();
            console.log(error);
        }

        return result;
    }

}