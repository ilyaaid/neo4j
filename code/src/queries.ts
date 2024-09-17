'use strict';

import { Driver, QueryResult, RecordShape, Session } from 'neo4j-driver'
import fs from 'fs';
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

        const jsonData = JSON.stringify(records);
        fs.writeFileSync(outpath, jsonData, 'utf8')
    }

    async queryFilter(nodeLabel: string, edgeLabel: string,
        fieldName: string, value: string, outputFilePath: string) {
        try {
            let q, recordKeys;
            if (this.graphName == GraphName.Elliptic || this.graphName == GraphName.RoadNet) {
                await createNodeIndex(this.session, nodeLabel, fieldName);
                q = `match (n:${nodeLabel})
                where n.${fieldName} >= ${value} return elementId(n)`;
                recordKeys = ['node'];
            } else {
                await createEdgeIndex(this.session, edgeLabel, fieldName);
                q = `match ()-[r:${edgeLabel}]->() 
                where r.${fieldName} >= ${value} return elementId(r)`;
                recordKeys = ['edge'];
            }

            console.log(q);
            let result = await this.session.run(q);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryFilter:', err)
            return;
        }
    }

    async queryFilterExt(nodeLabel: string, edgeLabel: string,
        fieldName: string, value: string, degree: number, outputFilePath: string) {
        try {
            let q, recordKeys;
            // TODO добавить создание и удаление индексов в запросы
            if (this.graphName == GraphName.Elliptic) {
                q = `MATCH (p:${nodeLabel})
                    where p.${fieldName} >= ${value}
                    MATCH (p)-[r:${edgeLabel}]->()
                    with p, count(r) as cnt
                    where cnt >= ${degree}
                    return elementId(p), cnt`;
            } else if (this.graphName == GraphName.RoadNet) {
                q = `MATCH (p:${nodeLabel})
                    MATCH (p)-[r:${edgeLabel}]->()
                    with p, count(r) as cnt
                    where cnt >= ${degree}
                    return elementId(p), cnt`
            } else {
                q = `MATCH (p:${nodeLabel})
                    MATCH (p)-[r:${edgeLabel}]->()
                    where r.${fieldName} >= ${value}
                    with p, count(r) as cnt
                    where cnt >= ${degree}
                    return elementId(p), cnt`;
            }
            recordKeys = ['node', 'degree'];

            console.log(q);
            let result = await this.session.run(q);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryFilterExt:', err)
            return;
        }
    }

    async queryFilterSum(nodeLabel: string, edgeLabel: string,
        fieldName: string, value: string, outputFilePath: string) {
        try {
            let q, recordKeys;
            if (this.graphName == GraphName.Elliptic) {
                q = `
                    MATCH (n:${nodeLabel})
                    MATCH (n)-[r:${edgeLabel}]->(m:${nodeLabel})
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
            let result = await this.session.run(q);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryFilterSum:', err)
            return;
        }
    }

    async queryShortestPath(fromNodeLabel: string, toNodeLabel: string,
        fromFieldName: string, toFieldName: string,
        fromValue: string, toValue: string,
        pathLengthLimit: string, outputFilePath: string) {
        try {
            let q, recordKeys;
            q = `
                MATCH 
                (start:${fromNodeLabel} {${fromFieldName}: ${fromValue}}), 
                (end:${toNodeLabel} {${toFieldName}: ${toValue}}),
                p = shortestPath((start)-[*..${pathLengthLimit}]-(end))
                RETURN nodes(p), length(p)
            `;
            recordKeys = ['nodes', 'length'];

            console.log(q);
            let result = await this.session.run(q);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryShortestPath:', err)
            return;
        }
    }



    async queryTriangles(nodeLabel: string, edgeLabel: string, outputFilePath: string) {
        try {
            let q = `
                MATCH 
                (a:${nodeLabel})-[:${edgeLabel}]-(b:${nodeLabel}),
                (b:${nodeLabel})-[:${edgeLabel}]-(c:${nodeLabel})
                where elementId(a) < elementId(b) AND elementId(b) < elementId(c) AND EXISTS((a)-[:${edgeLabel}]-(c))
                RETURN DISTINCT elementId(a), elementId(b), elementId(c)
            `;

            let recordKeys = ['a', 'b', 'c'];

            console.log(q);
            let result = await this.session.run(q);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryTriangles:', err)
            return;
        }
    }

    async queryTrianglesUpd(nodeLabel: string, edgeLabel: string, outputFilePath: string) {
        try {
            // const triangleLabel = `${nodeLabel}_triangle`
            // // удаляем существующие вершины с треугольниками
            // await this.session.run(`
            //     match (n:${triangleLabel})
            //     call {
            //         with n
            //         delete n
            //     } IN TRANSACTIONS OF 10000 ROWS;`);
            // console.log(`nodes ${triangleLabel} deleted`);

            // // выполняем запрос с поиском треугольников и их записи в вершины
            // await this.session.run(`
            //     CALL apoc.periodic.iterate(
            //         "MATCH (a:${nodeLabel})-[:${edgeLabel}]-(b:${nodeLabel}), (tmp:${nodeLabel} {_id:-1}) WHERE elementId(a) < elementId(b) return DISTINCT a, b, tmp",
            //         "MATCH (b:${nodeLabel})-[:${edgeLabel}]-(c:${nodeLabel}) 
            //         WHERE elementId(b) < elementId(c) AND EXISTS((a)-[:${edgeLabel}]-(c))
            //         WITH DISTINCT elementId(a) as a_id, elementId(b) as b_id, elementId(c) as c_id, tmp
            //         CREATE (:${triangleLabel} {a: a_id, b: b_id, c: c_id})
            //         ", {
            //         batchSize: 10000,
            //         parallel:true
            //     });
            //     `);
            
            
            // чтение вершин с треугольнками
            let q = `
                    MATCH (n:${nodeLabel}_triangle)
                    return n.a, n.b, n.c
                `;

            let recordKeys = ['a', 'b', 'c'];
            console.log(q);
            let result = await this.session.run(q);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryTriangles:', err)
            return;
        }
    }

    async queryDFS_BFS(bfs: boolean, fromLabel: string,
        fromFieldName: string, fromValue: string, edgeLabel: string,
        fieldName: string, value: string, depth: string, outputFilePath: string) {
        try {
            let q = ``;
            if (this.graphName == GraphName.Elliptic || this.graphName == GraphName.RoadNet) {
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
            let result = await this.session.run(q);
            this.putResult(result, recordKeys, outputFilePath);
        } catch (err) {
            console.error('error in queryDFS_BFS:', err)
            return;
        }
    }
}


