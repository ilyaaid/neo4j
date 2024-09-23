'use strict'

import { Driver, Session } from 'neo4j-driver';
import { createEdgeIndex, createNodeIndex, dropIndex, ILoader } from '../loader';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

export class MoocLoader implements ILoader {
    private driver: Driver;
    private session: Session;

    private config: any;

    constructor(driver: Driver, config: any) {
        this.driver = driver;
        this.session = this.driver.session();

        this.config = config;
    }

    async editFile(filename: string) {
        let actions = await new Promise<any[]>((resolve) => {
            Papa.parse(fs.readFileSync(filename, 'utf8'), {
                header: true,
                complete: function (results) {
                    resolve(results.data);
                },
                dynamicTyping: true,
            })
        });

        for (const ind in actions) {
            if (actions[ind]['ACTIONID'] != null && actions[ind]['ACTIONID'] != ind) {
                actions[ind]['ACTIONID'] = Number(ind);
            }
        }

        if (actions.length > 0 && actions[actions.length - 1]['ACTIONID'] == null) {
            actions.pop();
        }

        let csvContent = Papa.unparse(actions, {
            header: true,
            delimiter: '\t',
        })
        fs.writeFileSync(filename.slice(0, -path.extname(filename).length) + '_edit.csv',
            csvContent, 'utf8');
    }

    async editFiles() {
        const dir = '../neo4j/import/act-mooc/'
        await this.editFile(dir + 'mooc_action_labels.tsv');
        await this.editFile(dir + 'mooc_action_features.tsv');
        await this.editFile(dir + 'mooc_actions.tsv');
        console.log('mooc editing done');
    }

    async createIndex(): Promise<void> {
        await createNodeIndex(this.session, this.config['UserLabel'], 'USERID');
        await createNodeIndex(this.session, this.config['TargetLabel'], 'TARGETID');
        await createEdgeIndex(this.session, this.config['ActionLabel'], 'ACTIONID');
    }

    async createData(): Promise<void> {
        // TODO убрать коммент
        await this.editFiles();
        let result;


        result = await this.session.run(`
            load csv with headers from 'file:///act-mooc/mooc_actions_edit.csv' as act
            FIELDTERMINATOR '\t'
            CALL {
            with act
            merge (user: ${this.config['UserLabel']} {USERID: toInteger(act.USERID)})
            merge (target: ${this.config['TargetLabel']} {TARGETID: toInteger(act.TARGETID)})

            create (user)-
            [action: ${this.config['ActionLabel']}
            {ACTIONID: toInteger(act.ACTIONID),
            TIMESTAMP: toFloat(act.TIMESTAMP)}]
            ->(target)

            } IN TRANSACTIONS OF 1000 ROWS;
            `);

        console.log('mooc create without action label and features');

        result = await this.session.run(`
            load csv with headers from 'file:///act-mooc/mooc_action_labels_edit.csv' as act
            FIELDTERMINATOR '\t'
            CALL {
            with act
            match ()-[action:${this.config['ActionLabel']} {ACTIONID: toInteger(act.ACTIONID)}]->()
            set action.LABEL = toInteger(act.LABEL) 
        } IN TRANSACTIONS OF 1000 ROWS;
            `);

        result = await this.session.run(`
                load csv with headers from 'file:///act-mooc/mooc_action_features_edit.csv' as act
                FIELDTERMINATOR '\t'
                CALL {
                with act
                match ()-[action:${this.config['ActionLabel']} {ACTIONID: toInteger(act.ACTIONID)}]->()
                set action.FEATURE0 = toFloat(act.FEATURE0),
                action.FEATURE1 = toFloat(act.FEATURE1),
                action.FEATURE2 = toFloat(act.FEATURE2),
                action.FEATURE3 = toFloat(act.FEATURE3)
            } IN TRANSACTIONS OF 1000 ROWS;
                `);

        console.log('mooc create with full actions');
    }

    async create() {
        await this.createIndex();
        await this.createData();
    }

    async deleteData(): Promise<void> {
        let result;

        result = await this.session.run(`
            match ()-[act:${this.config['ActionLabel']}]->()
            call {
                with act
                delete act
            } IN TRANSACTIONS OF 10000 ROWS;`);

        result = await this.session.run(`
            match (target:${this.config['TargetLabel']})
            call {
                with target
                delete target
            } IN TRANSACTIONS OF 10000 ROWS;`);

        result = await this.session.run(`
            match (user:${this.config['UserLabel']})
            call {
                with user
                delete user
            } IN TRANSACTIONS OF 10000 ROWS;`);

        console.log('drop data');
    }

    async deleteIndex(): Promise<void> {
        await dropIndex(this.session, this.config['UserLabel'], 'USERID');
        await dropIndex(this.session, this.config['TargetLabel'], 'TARGETID');
        await dropIndex(this.session, this.config['ActionLabel'], 'ACTIONID');
        console.log('drop index');
    }

    async delete() {
        await this.deleteData();
        await this.deleteIndex();
    }

}
