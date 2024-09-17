'use strict'

import { Driver, Session } from 'neo4j-driver';
import { createNodeIndex, dropIndex, ILoader } from '../loader';

export class StableCoinLoader implements ILoader {
    private driver: Driver;
    private session: Session;

    private config: any;

    constructor(driver: Driver, config: any) {
        this.driver = driver;
        this.session = this.driver.session();

        this.config = config;
    }

    async createIndex() {
        await createNodeIndex(this.session, this.config['AddressLabel'], 'addressId');
        console.log('create index');
    }

    async createData() {
        let result;
        // TODO заменить файл CSV на основной
        result = await this.session.run(
            `
            load csv with headers from 'file:///ERC20-stablecoins/token_transfers_V2.0.0.csv' as trans
            FIELDTERMINATOR ','
            CALL {
                with trans
                with trans
                where trans.contract_address = "0xdac17f958d2ee523a2206206994597c13d831ec7"
                
                merge (from:${this.config['AddressLabel']} {addressId:trans.from_address})
                merge (to:${this.config['AddressLabel']} {addressId:trans.to_address})

                create (from)-[:${this.config['ActionLabel']} 
                {
                time_stamp: toFloat(trans.time_stamp), 
                value: toFloat(trans.value)
                }]->(to)
            } IN TRANSACTIONS OF 10000 ROWS;
            `
        );
        console.log('create data');
    }

    async create() {
        await this.createIndex();
        await this.createData();
    }

    async deleteData() {
        let result;

        result = await this.session.run(`
            match ()-[act:${this.config['ActionLabel']}]->()
            call {
                with act
                delete act
            } IN TRANSACTIONS OF 10000 ROWS;`
        );

        result = await this.session.run(`
            match (addr:${this.config['AddressLabel']})
            call {
                with addr
                delete addr
            } IN TRANSACTIONS OF 10000 ROWS;`
        );

        console.log('drop data');
    }

    async deleteIndex() {
        await dropIndex(this.session, this.config['AddressLabel'], 'addressId');
        console.log('drop index');
    }

    async delete() {
        await this.deleteIndex();
        await this.deleteData();
    }

}
