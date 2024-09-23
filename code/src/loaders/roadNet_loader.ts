'use strict'

import { Driver, Session } from 'neo4j-driver';
import { createNodeIndex, dropIndex, ILoader } from '../loader';
import path from 'path';
import Papa from 'papaparse';
import fs from 'fs';

export class RoadNetLoader implements ILoader {
    private driver: Driver;
    private session: Session;

    private config: any;

    constructor(driver: Driver, config: any) {
        this.driver = driver;
        this.session = this.driver.session();

        this.config = config;
    }

    async editFile() {
        const dir = '../neo4j/import/roadNet-CA.txt/';
        const filename = dir + 'roadNet-CA.txt';

        let data = fs.readFileSync(filename, 'utf8')
        let lines = data.split('\n').slice(3)
        lines[0] = lines[0].slice(2);
        while (lines[lines.length - 1] == '' || lines[lines.length - 1] == '\r') {
            lines.pop();
        }
        data = lines.join('\n');

        let actions = await new Promise<any[]>((resolve) => {
            Papa.parse(data, {
                delimiter: '\t',
                header: true,
                complete: function (results) {
                    resolve(results.data);
                },
                dynamicTyping: true,
            })
        });

        let csvContent = Papa.unparse(actions, {
            header: true,
            delimiter: '\t',
        })
        fs.writeFileSync(filename.slice(0, -path.extname(filename).length) + '_edit.csv',
            csvContent, 'utf8');

        console.log('roadNet editing done');

    }

    async createIndex() {
        await createNodeIndex(this.session, this.config['NodeLabel'], 'NodeId');
        console.log('create index');
    }

    async createData() {
        // TODO убрать коммент
        await this.editFile();

        let result = await this.session.run(
            `
            load csv with headers from 'file:///roadNet-CA.txt/roadNet-CA_edit.csv' as edge
            FIELDTERMINATOR '\t'
            CALL {
                with edge
                merge (from :${this.config['NodeLabel']} {NodeId: toInteger(edge.FromNodeId)})
                merge (to :${this.config['NodeLabel']} {NodeId: toInteger(edge.ToNodeId)})
                create (from)-[:${this.config['EdgeLabel']}]->(to)
            } IN TRANSACTIONS OF 10000 ROWS;
            `
        );

        console.log(result.summary.query);
        console.log('create data');
    }

    async create() {
        await this.createIndex();
        await this.createData();
    }

    async deleteData() {
        let result;

        result = await this.session.run(`
            match ()-[e:${this.config['EdgeLabel']}]->()
            call {
                with e
                delete e
            } IN TRANSACTIONS OF 10000 ROWS;`
        );

        console.log(result.summary.query);

        result = await this.session.run(`
            match (n:${this.config['NodeLabel']})
            call {
                with n
                delete n
            } IN TRANSACTIONS OF 10000 ROWS;`
        );

        console.log(result.summary.query);
        console.log('drop data');
    }

    async deleteIndex() {
        await dropIndex(this.session, this.config['NodeLabel'], 'NodeId');
        console.log('drop index');
    }

    async delete() {
        await this.deleteData();
        await this.deleteIndex();
    }
}
