'use strict';

import fs from 'fs'
import neo4j, { Driver } from 'neo4j-driver'
import DataLoader, { editModes, editTargets } from './loader';

import { program } from 'commander'
import { Neo4jQuery } from './queries';

const URI = 'neo4j://localhost:7687'
const USER = 'neo4j'
const PASSWORD = 'neo4jtest'

function parseConfigFile(filename: string): any {
    let data;
    try {
        data = fs.readFileSync(filename, 'utf8');
    } catch (err) {
        throw new Error('error in reading config file:' + err);
    }
    const config = JSON.parse(data);
    return config;
}

async function main() {
    let driver: Driver

    try {
        driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

        // const serverInfo = await driver.getServerInfo();
        console.log('Connection established');

        program
            .command('data <configFile:string> <editMode:string> <editTarget:string>')
            .description('action with data')
            .action(async (configFile, editMode, editTarget) => {
                if (!(editModes.includes(editMode))) {
                    program.error(`wrong edit mode: ${editMode}`)
                }
                if (!(editTargets.includes(editTarget))) {
                    program.error(`wrong edit target: ${editTarget}`)
                }

                const config = parseConfigFile(configFile);

                let dl = new DataLoader(driver, editMode, editTarget, config);
                await dl.load();
                await dl.close();
            });

        program
            .command('query <configFile:string>')
            .description('query with data')
            .action(async (configFile) => {
                const config = parseConfigFile(configFile);

                const graph = config['graphName'];
                let query = new Neo4jQuery(driver, graph)

                const resultDir = `../results/result_${graph}`;

                // Выбор всех вершин или ребер с заданным значением поля.
                const qFilterConf = config['queryFilter'];
                // await query.queryFilter(qFilterConf['nodeLabel'], qFilterConf['edgeLabel'],
                //     qFilterConf['fieldName'], qFilterConf['value'], resultDir + '/queryFilter.json');

                // Выбор всех вершин с заданным значением поля 
                // + фильтр по связям (степень вершины с учётом условия на связи данной вершины).
                const qFilterExtConf = config['queryFilterExt'];
                // await query.queryFilterExt(
                //     qFilterExtConf['nodeLabel'],
                //     qFilterExtConf['edgeLabel'],
                //     qFilterExtConf['fieldName'],
                //     qFilterExtConf['value'],
                //     qFilterExtConf['degree'],
                //     resultDir + '/queryFilterExt.json');


                // Подсчёт для каждой вершины суммы некоторого параметра по всем соседним вершинам
                // с ограничением на связь/значение параметра 
                // (например, учитывать значение в сумме, если оно превышает некоторый порог).
                const qFilterSum = config['queryFilterSum'];
                // await query.queryFilterSum(qFilterSum['nodeLabel'], qFilterSum['edgeLabel'],
                //     qFilterSum['fieldName'], qFilterSum['value'],
                //     resultDir + '/queryFilterSum.json');

                // Кратчайшее расстояние между двумя вершинами
                const qShortestPath = config['queryShortestPath'];
                // await query.queryShortestPath(
                //     qShortestPath['fromNodeLabel'], qShortestPath['toNodeLabel'],
                //     qShortestPath['fromFieldName'], qShortestPath['toFieldName'], 
                //     qShortestPath['fromValue'], qShortestPath['toValue'],
                //     qShortestPath['pathLengthLimit'], resultDir + '/queryShortestPath.json'
                // );

                // Нахождение всех треугольников в графе (без учета ориентации)
                const qTriangles = config['queryTriangles'];
                // await query.queryTriangles(qTriangles['nodeLabel'], qTriangles['edgeLabel'],
                //     resultDir + '/queryTriangles.json');

                const startTime = performance.now();

                await query.queryTrianglesUpd(qTriangles['nodeLabel'], qTriangles['edgeLabel'],
                    resultDir + '/queryTriangles.json');

                const endTime = performance.now();
                const result = (endTime - startTime) / 1000;
                console.log(`Время выполнения: ${result} секунд`);
                fs.writeFileSync("stats.txt", `${result}`);

                // Обход графа в глубину и в ширину
                const qDFS_BFS = config['queryDFS_BFS'];
                // TODO добавить true в массив
                // for (let bfs of [false]) {
                //     await query.queryDFS_BFS(bfs, qDFS_BFS['fromLabel'], qDFS_BFS['fromFieldName'],
                //         qDFS_BFS['fromValue'], qDFS_BFS['edgeLabel'], qDFS_BFS['fieldName'],
                //         qDFS_BFS['value'], qDFS_BFS['depth'],
                //         resultDir + `/query${bfs ? 'BFS' : 'DFS'}.json`);
                // }
            });

        await program.parseAsync(process.argv);
        await driver.close();
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.log(`Connection error\n${err}\nCause: ${err}`)
        }
    }
}

main()
