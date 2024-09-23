'use strict'

import { Driver, Session } from 'neo4j-driver';
import { createNodeIndex, dropIndex, ILoader } from '../loader';

export class EllipticLoader implements ILoader {
    private driver: Driver;
    private session: Session;

    private config: any;

    constructor(driver: Driver, config: any) {
        this.driver = driver;
        this.session = this.driver.session();

        this.config = config;
    }

    async createIndex(): Promise<void> {
        await createNodeIndex(this.session, this.config['TransactionLabel'], 'txId');
    }

    async createData(): Promise<void> {
        let result;

        result = await this.session.run(`
            load csv with headers from 'file:///elliptic/txs_features.csv' as tx
            CALL {
                with tx
                create (newTx :${this.config['TransactionLabel']}
                {
                    txId: toInteger(tx.txId),
                    timestamp: toFloat(tx.timestamp),
                    Local_feature_1: toFloat(tx.Local_feature_1),
                    Aggregate_feature_1: toFloat(tx.Aggregate_feature_1),
                    in_txs_degree: toFloat(tx.in_txs_degree),
                    out_txs_degree: toFloat(tx.out_txs_degree),
                    total_BTC: toFloat(tx.total_BTC),
                    fees: toFloat(tx.fees),
                    size: toFloat(tx.size),
                    num_input_addresses: toFloat(tx.num_input_addresses),
                    num_output_addresses: toFloat(tx.num_output_addresses),
                    in_BTC_min: toFloat(tx.in_BTC_min),
                    in_BTC_max: toFloat(tx.in_BTC_max),
                    in_BTC_mean: toFloat(tx.in_BTC_mean),
                    in_BTC_median: toFloat(tx.in_BTC_median),
                    in_BTC_total: toFloat(tx.in_BTC_total),
                    out_BTC_min: toFloat(tx.out_BTC_min),
                    out_BTC_max: toFloat(tx.out_BTC_max),
                    out_BTC_mean: toFloat(tx.out_BTC_mean),
                    out_BTC_median: toFloat(tx.out_BTC_median),
                    out_BTC_total: toFloat(tx.out_BTC_total)
                })
            } IN TRANSACTIONS OF 10000 ROWS;
            `)

        console.log(result)

        result = await this.session.run(`
            load csv with headers from 'file:///elliptic/txs_classes.csv' as tx
            CALL {
                with tx
                match (newTx :${this.config['TransactionLabel']} {txId: toInteger(tx.txId)})
                set newTx.class = toInteger(tx.class)
            } IN TRANSACTIONS OF 10000 ROWS;`);

        console.log(result)

        result = await this.session.run(`
            load csv with headers from 'file:///elliptic/txs_edgelist.csv' as edge
            CALL {
                with edge
                match (tx1 :${this.config['TransactionLabel']} {txId: toInteger(edge.txId1)})
                match (tx2 :${this.config['TransactionLabel']} {txId: toInteger(edge.txId2)})
                create (tx1)-[r:${this.config['EdgeLabel']}]->(tx2)
            } IN TRANSACTIONS OF 10000 ROWS;
             `)

        console.log(result)
    }

    async create() {
        await this.createIndex();
        await this.createData();
    }

    async deleteData(): Promise<void> {
        let result;
        result = await this.session.run(`
            match (t:${this.config['TransactionLabel']})
            call {
                with t
                detach delete t
            } IN TRANSACTIONS OF 1000 ROWS;`);

        console.log('drop data');
    }

    async deleteIndex(): Promise<void> {
        await dropIndex(this.session, this.config['TransactionLabel'], 'txId');
        console.log('drop index');
    }

    async delete() {
        await this.deleteData();
        await this.deleteIndex();
    }
}
