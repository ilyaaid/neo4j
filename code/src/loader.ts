'use strict';

import { Driver, Session } from 'neo4j-driver'
import { GraphName } from './graphs_config';
import { EllipticLoader } from './loaders/elliptic_loader';
import { MoocLoader } from './loaders/mooc_loader';
import { RoadNetLoader } from './loaders/roadNet_loader';
import { StableCoinLoader } from './loaders/stableCoin_loader';

const enum EditMode {
    CREATE = 'create',
    DELETE = 'delete',
}

const enum EditTarget {
    INDEX = 'index',
    DATA = 'data',
    ALL = 'all',

}

export const editTargets: EditTarget[] = [EditTarget.INDEX, EditTarget.DATA, EditTarget.ALL];

export const editModes: EditMode[] = [EditMode.CREATE, EditMode.DELETE];

export interface ILoader {
    create(): Promise<void>;
    delete(): Promise<void>;
    createData(): Promise<void>;
    deleteData(): Promise<void>;
    createIndex(): Promise<void>;
    deleteIndex(): Promise<void>;
}

export async function createNodeIndex(session: Session, nodeLabel: string, fieldName: string) {
    const indexName = `${nodeLabel}_${fieldName}_index`;
    let result = await session.run(`
        CREATE INDEX ${indexName} IF NOT EXISTS for (n:${nodeLabel}) on (n.${fieldName});
    `);
    await session.run(`call db.awaitIndex('${indexName}');`);
}

export async function createEdgeIndex(session: Session, edgeLabel: string, fieldName: string) {
    const indexName = `${edgeLabel}_${fieldName}_index`;
    let result = await session.run(`
        CREATE INDEX ${indexName} IF NOT EXISTS for ()-[e:${edgeLabel}]->() on (e.${fieldName});
    `);
    await session.run(`call db.awaitIndex('${indexName}');`);
}


export async function dropIndex(session: Session, label: string, fieldName: string) {
    let result = await session.run(`
        drop index ${label}_${fieldName}_index if exists`);
}

// export async function awaitIndexes(session: Session): Promise<void> {
//     await session.run(`call db.awaitIndexes();`);
// }

export default class DataLoader {
    private driver: Driver;
    private session: Session;

    private config: any;

    private editMode: EditMode;
    private editTarget: EditTarget;

    constructor(driver: Driver, editMode: EditMode, editTarget: EditTarget, config: any) {
        this.driver = driver;
        this.session = this.driver.session();
        this.editMode = editMode;
        this.editTarget = editTarget;
        this.config = config;
    }

    async close() {
        await this.session.close();
    }

    getLoader(): ILoader | undefined {
        switch (this.config['graphName']) {
            case GraphName.Elliptic: return new EllipticLoader(this.driver, this.config);
            case GraphName.Mooc: return new MoocLoader(this.driver, this.config);
            case GraphName.RoadNet: return new RoadNetLoader(this.driver, this.config);
            case GraphName.StableCoin: return new StableCoinLoader(this.driver, this.config);
        }

        return undefined;
    }

    selectLoaderMethod(loader: ILoader): Promise<void> | undefined {
        switch (this.editMode) {
            case EditMode.CREATE: {
                switch (this.editTarget) {
                    case EditTarget.ALL: return loader.create();
                    case EditTarget.INDEX: return loader.createIndex();
                    case EditTarget.DATA: return loader.createData();
                }
            }
            case EditMode.DELETE: {
                switch (this.editTarget) {
                    case EditTarget.ALL: return loader.delete();
                    case EditTarget.INDEX: return loader.deleteIndex();
                    case EditTarget.DATA: return loader.deleteData();
                }
            }
        }
    }

    async load() {
        const loader = this.getLoader();
        if (!loader) {
            throw new Error('Unknown loader');
        }

        await this.selectLoaderMethod(loader);
    }

}

