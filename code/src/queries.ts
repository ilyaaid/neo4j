'use strict';

import { Driver, QueryResult, RecordShape, Session } from 'neo4j-driver'
import fs, { stat } from 'fs';
import path from 'path';
import { GraphName } from './graphs_config';
import { createEdgeIndex, createNodeIndex } from './loader';

interface RecordObjType {
    [key: string]: string;
}

export class Neo4jQuery {
    private driver: Driver;
    private session: Session;

    private graphName: string;

    constructor(driver: Driver, graphName: string) {
        this.driver = driver;
        this.session = this.driver.session();
        this.graphName = graphName;
    }

    putResult(result: QueryResult<RecordShape>, recordKeys: string[], outpath: string) {
        const directory = path.dirname(outpath);
        fs.mkdirSync(directory, { recursive: true });

        const records = {
            query: result.summary.query,
            records: result.records.map((record) => {
                const recordObj = recordKeys.reduce((obj, key, ind) => {
                    obj[key] = record.get(ind);
                    return obj;
                }, {} as RecordObjType);
                return recordObj
            }),
            size: result.records.length
        };

        const jsonData = JSON.stringify(records, null, 2);
        fs.writeFileSync(outpath, jsonData, 'utf8');
    }

    putStat(result: QueryResult<RecordShape>, duration: number, outpath: string) {
        const directory = path.dirname(outpath);
        fs.mkdirSync(directory, { recursive: true });

        const jsonData = JSON.stringify({
            duration,
            query: result.summary.query.text,
            profile: result.summary.profile
        }, null, 2);
        fs.writeFileSync(outpath, jsonData, 'utf8');
    }

    async queryFilter(nodeLabel: string, edgeLabel: string,
        fieldName: string, value: string, outputFilePath: string, statFilePath: string) {
        try {
            let q, recordKeys;

            if (this.graphName == GraphName.Elliptic || this.graphName == GraphName.RoadNet) {
                await createNodeIndex(this.session, nodeLabel, fieldName);
                q = `match (n:${nodeLabel})
                where n.${fieldName} >= ${value} return elementId(n)`;
                recordKeys = ['node'];
            } else if (this.graphName == GraphName.Mooc) {
                await createEdgeIndex(this.session, edgeLabel, fieldName);
                q = `match ()-[r:${edgeLabel}]->() 
                where r.${fieldName} >= ${value} return elementId(r)`;
                recordKeys = ['edge'];
            } else {
                await createEdgeIndex(this.session, edgeLabel, fieldName);
                q = `match ()-[r:${edgeLabel}]->() 
                where r.${fieldName} = ${value} return elementId(r)`;
                recordKeys = ['edge'];
            }
            console.log(q);

            const startTime = performance.now();
            let result = await this.session.run('PROFILE ' + q);
            const duration = (performance.now() - startTime) / 1000;
            this.putStat(result, duration, statFilePath);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryFilter:', err)
            return;
        }
    }

    async queryFilterExt(nodeLabel: string, edgeLabel: string,
        fieldName: string, value: string, degree: number, outputFilePath: string, statFilePath: string) {
        try {
            let q, recordKeys;
            if (this.graphName == GraphName.Elliptic) {
                await createNodeIndex(this.session, nodeLabel, fieldName);
                q = `MATCH (p:${nodeLabel})
                    where p.${fieldName} >= ${value}
                    MATCH (p)-[r:${edgeLabel}]->()
                    with p, count(r) as cnt
                    where cnt >= ${degree}
                    return elementId(p), cnt`;
            } else if (this.graphName == GraphName.RoadNet) {
                q = `MATCH (p:${nodeLabel}), (p)-[r:${edgeLabel}]->()
                    with p, count(r) as cnt
                    where cnt >= ${degree}
                    return elementId(p), cnt`
            } else {
                await createEdgeIndex(this.session, edgeLabel, fieldName);
                q = `MATCH (p:${nodeLabel}), (p)-[r:${edgeLabel}]->()
                    where r.${fieldName} >= ${value}
                    with p, count(r) as cnt
                    where cnt >= ${degree}
                    return elementId(p), cnt`;
            }
            recordKeys = ['node', 'degree'];

            console.log(q);
            const startTime = performance.now();
            let result = await this.session.run('PROFILE ' + q);
            const duration = (performance.now() - startTime) / 1000;
            this.putStat(result, duration, statFilePath);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryFilterExt:', err)
            return;
        }
    }

    async queryFilterSum(nodeLabel: string, edgeLabel: string,
        fieldName: string, value: string, outputFilePath: string, statFilePath: string) {
        try {
            let q, recordKeys;
            if (this.graphName == GraphName.Elliptic) {
                await createNodeIndex(this.session, nodeLabel, fieldName);
                q = `
                    MATCH (n:${nodeLabel}), (n)-[r:${edgeLabel}]->(m:${nodeLabel})
                    where m.${fieldName} >= ${value}
                    WITH n, COLLECT(m.${fieldName}) AS neighbors
                    RETURN elementId(n), REDUCE(total = 0, val IN neighbors | total + val);
                `;
                recordKeys = ['node', 'sum'];
            } else if (this.graphName == GraphName.RoadNet) {
                q = `
                    MATCH (n:${nodeLabel})
                    RETURN elementId(n)
                `;
                recordKeys = ['node'];
            } else {
                await createEdgeIndex(this.session, edgeLabel, fieldName);
                q = `
                    MATCH (n:${nodeLabel})
                    MATCH (n)-[r:${edgeLabel}]->()
                    where r.${fieldName} >= ${value}
                    WITH n, COLLECT(r.${fieldName}) AS neighbors
                    RETURN elementId(n), REDUCE(total = 0, val IN neighbors | total + val);
                `;
                recordKeys = ['node', 'sum'];
            }

            console.log(q);
            const startTime = performance.now();
            let result = await this.session.run('PROFILE ' + q);
            const duration = (performance.now() - startTime) / 1000;
            this.putStat(result, duration, statFilePath);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryFilterSum:', err)
            return;
        }
    }

    async queryShortestPath(fromNodeLabel: string, toNodeLabel: string,
        fromFieldName: string, toFieldName: string,
        fromValue: string, toValue: string,
        pathLengthLimit: string,
        outputFilePath: string,
        statFilePath: string) {
        try {
            let q, recordKeys;
            q = `
                MATCH 
                (start:${fromNodeLabel} {${fromFieldName}: ${fromValue}}), 
                (end:${toNodeLabel} {${toFieldName}: ${toValue}}),
                p = shortestPath((start)-[*]-(end))
                RETURN nodes(p), length(p)
            `;
            recordKeys = ['nodes', 'length'];

            console.log(q);
            const startTime = performance.now();
            let result = await this.session.run('PROFILE ' + q);
            const duration = (performance.now() - startTime) / 1000;
            this.putStat(result, duration, statFilePath);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryShortestPath:', err)
            return;
        }
    }

    async queryTrianglesUpd(nodeLabel: string, edgeLabel: string,
        outputFilePath: string,
        statFilePath: string) {
        try {
            const triangleLabel = `${nodeLabel}_triangle`
            // удаляем существующие вершины с треугольниками
            await this.session.run(`
                match (n:${triangleLabel})
                call {
                    with n
                    delete n
                } IN TRANSACTIONS OF 10000 ROWS;`);
            console.log(`nodes ${triangleLabel} deleted`);

            const startTime = performance.now();
            // выполняем запрос с поиском треугольников и их записи в вершины
            let q = `
                PROFILE CALL apoc.periodic.iterate(
                    "MATCH (a:${nodeLabel})-[:${edgeLabel}]-(b:${nodeLabel}) WHERE elementId(a) < elementId(b) return DISTINCT a, b",
                    "MATCH (b:${nodeLabel})-[:${edgeLabel}]-(c:${nodeLabel}) 
                    WHERE elementId(b) < elementId(c) AND EXISTS((a)-[:${edgeLabel}]-(c)) 
                    WITH DISTINCT elementId(a) as a_id, elementId(b) as b_id, elementId(c) as c_id 
                    CREATE (:${triangleLabel} {a: a_id, b: b_id, c: c_id})", {
                    batchSize: 10000,
                    parallel:true
                });
            `;
            console.log(q);
            let result = await this.session.run(q);

            console.log(result.summary.query.text);
            const duration = (performance.now() - startTime) / 1000;
            this.putStat(result, duration, statFilePath);

            // чтение вершин с треугольнками
            q = `
                    MATCH (n:${nodeLabel}_triangle)
                    return n.a, n.b, n.c
                `;

            let recordKeys = ['a', 'b', 'c'];
            console.log(q);
            result = await this.session.run(q);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryTriangles:', err)
            return;
        }
    }

    async queryRecurse(fromLabel: string,
        fromFieldName: string, fromValue: string, edgeLabel: string,
        fieldName: string, value: string, depth: string, outputFilePath: string,
        statFilePath: string) {
        try {
            let q = ``;
            if (this.graphName == GraphName.Elliptic || this.graphName == GraphName.RoadNet) {
                await createNodeIndex(this.session, fromLabel, fieldName);
                q = `
                    MATCH (start:${fromLabel} {${fromFieldName}: ${fromValue}})
                    CALL {
                        WITH start
                        MATCH (start)-[r1:${edgeLabel}*${depth}..${depth}]->(n1:${fromLabel})
                        where ALL(rel in r1 where endNode(rel).${fieldName} >= ${value})
                        RETURN DISTINCT n1
                    }
                    RETURN elementId(n1)
                `;
            } else {
                await createEdgeIndex(this.session, edgeLabel, fieldName);
                q = `
                    MATCH (start:${fromLabel} {${fromFieldName}: ${fromValue}})
                    CALL {
                        WITH start
                        MATCH (start)-[r1:${edgeLabel}*${depth}..${depth}]->(n1:${fromLabel})
                        where ALL(rel in r1 where rel.${fieldName} >= ${value})
                        RETURN DISTINCT n1
                    }
                    RETURN elementId(n1)
                `;
            }

            let recordKeys = ['lastVertex'];

            console.log(q);
            const startTime = performance.now();
            let result = await this.session.run('PROFILE ' + q);

            const duration = (performance.now() - startTime) / 1000;
            this.putStat(result, duration, statFilePath);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryDFS_BFS:', err)
            return;
        }
    }




    // async queryTriangles(nodeLabel: string, edgeLabel: string, outputFilePath: string) {
    //     try {
    //         let q = `
    //             MATCH 
    //             (a:${nodeLabel})-[:${edgeLabel}]-(b:${nodeLabel}),
    //             (b:${nodeLabel})-[:${edgeLabel}]-(c:${nodeLabel})
    //             where elementId(a) < elementId(b) AND elementId(b) < elementId(c) AND EXISTS((a)-[:${edgeLabel}]-(c))
    //             RETURN DISTINCT elementId(a), elementId(b), elementId(c)
    //         `;

    //         let recordKeys = ['a', 'b', 'c'];

    //         console.log(q);
    //         let result = await this.session.run(q);
    //         this.putResult(result, recordKeys, outputFilePath);
    //     } catch (err) {
    //         console.error('error in queryTriangles:', err)
    //         return;
    //     }
    // }
}


