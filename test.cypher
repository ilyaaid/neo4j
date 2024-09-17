// Создание
CREATE INDEX TestNode_id_index IF NOT EXISTS for (n:TestNode) on (n.id);
call db.awaitIndexes();

load csv with headers from 'file:///test/test_nodes.csv' as n
create (newN :TestNode {id:toInteger(n.id), value:toFloat(n.value)});

load csv with headers from 'file:///test/test_edges.csv' as edge
match (n1 :TestNode {id: toInteger(edge.from)})
match (n2 :TestNode {id: toInteger(edge.to)})
create (n1)-[e:TestEdge {timestamp: toFloat(edge.timestamp)}]->(n2);


// Удаление
match (n:TestNode) detach delete n;
drop index TestNode_id_index IF EXISTS;



//Поиск
match (n:TestNode) return n;


// FilterSum
// для эллиптика
MATCH (n:TestNode)
OPTIONAL MATCH (n)-[r]->(m:TestNode)
where m.value >= 100
WITH n, COLLECT(m.value) AS neighbors
RETURN elementId(n), neighbors, REDUCE(total = 0, val IN neighbors | total + val);

// для моока и стейблкоина
MATCH (n:TestNode)
OPTIONAL MATCH (n)-[r]->(m:TestNode)
where r.timestamp >= 10
WITH n, COLLECT(r.timestamp) AS neighbors
RETURN n, neighbors, REDUCE(total = 0, val IN neighbors | total + val);



// ShortestPath
MATCH (start:TestNode {id: 7}), (end:TestNode {id: 9}),
p = shortestPath((start)-[*..8]-(end))
RETURN p;


//DFS
MATCH (source:TestNode)-[r:TestEdge]->(target:TestNode)
RETURN gds.graph.project(
  'myGraph',
  source,
  target
)

MATCH (start:TestNode {id: 6})
CALL gds.dfs.stream(
  'myGraph',
  {
    sourceNode: start,
    maxDepth: 10
  }
)
YIELD path
RETURN path;

// обход в глубину с учетом направления ребер и фильтрацией вершин (значение поле value, меньше которого быть не должно)
MATCH (start:${fromLabel} {${fromFieldName}: ${fromValue}})
CALL apoc.path.expandConfig(
start,
{
    relationshipFilter: "${edgeLabel}>",
    bfs: ${bfs ? 'true' : 'false'},
    minLevel: ${depth},
    maxLevel: ${depth}
}
)
YIELD path
WHERE ALL(node IN nodes(path) WHERE node.${fieldName} >= ${value})
RETURN DISTINCT elementId(last(nodes(path)))




// обход в ширину
MATCH (start:TestNode {id: 6})
CALL apoc.path.expandConfig(
  start,
  {
    relationshipFilter: "TestEdge>",
    bfs: true,
    minLevel: 3,
    maxLevel: 3
  }
)
YIELD path
WHERE ALL(node IN nodes(path) WHERE node.value >= 2)
RETURN elementId(last(nodes(path))), length(path)



// подсчет всех треугольников
MATCH (a)-[:TestEdge]-(b), (a)-[:TestEdge]-(c)
WHERE (b)-[]-(c) AND elementId(a) < elementid(b) AND elementId(b) < elementId(c)
WITH a, b, c
SKIP 0
LIMIT 10000
RETURN a.id, b.id, c.id



match ()-[t:TRIANGLE]->() delete t;

CALL apoc.periodic.iterate(
  "MATCH (a)-[:TestNode]-(b) return a, b",
  "MATCH (a)-[:TestNode]-(c) WHERE (b)-[]-(c) AND elementId(a) < elementid(b) AND elementId(b) < elementId(c) RETURN elementId(a), elementId(b), elementId(c)", {
  batchSize: 5,
  parallel: true
})

MATCH (a)-[:TRIANGLE]->(b)-[:TRIANGLE]->(c)
RETURN a.id, b.id, c.id


// похоже самый лучший способ нахождения треугольников
match (n:TestNode {_id:-1}) delete n;
create (n:TestNode {_id:-1, triangles:[]});

CALL apoc.periodic.iterate(
    "MATCH (a:TestNode)-[:TestEdge]-(b:TestNode), (tmp:TestNode {_id:-1}) WHERE elementId(a) < elementId(b) return a, b, tmp",
    "MATCH (b:TestNode)-[:TestEdge]-(c:TestNode) WHERE elementId(b) < elementId(c) AND EXISTS((a)-[:TestEdge]-(c)) set tmp.triangles = tmp.triangles + [apoc.convert.toJson([elementId(a), elementId(b), elementId(c)])]", {
    batchSize: 10000
});

// WITH DISTINCT elementId(a) as a_id, elementId(b) as b_id, elementId(c) as c_id, tmp
// [apoc.convert.toJson([elementId(a), elementId(b), elementId(c)])]
// [apoc.convert.toJson([a_id, b_id, c_id])]

MATCH (n:TestNode {_id:-1})
UNWIND n.triangles AS myTriple
with apoc.convert.fromJsonList(myTriple) as triple
return triple[0], triple[1], triple[2];



MATCH (start:TestNode {id: 10})
CALL {
    WITH start
    MATCH (start)-[r1:TestEdge*2..2]->(n1:TestNode)
    where ALL(rel in r1 where rel.value > 493112)
    RETURN DISTINCT n1
}
RETURN count(*)

















CALL apoc.periodic.iterate(
                    "MATCH (a:${nodeLabel})-[:${edgeLabel}]-(b:${nodeLabel}), (tmp:${nodeLabel} {_id:-1}) WHERE elementId(a) < elementId(b) return DISTINCT a, b, tmp",
                    "MATCH (b:${nodeLabel})-[:${edgeLabel}]-(c:${nodeLabel}) 
                    WHERE elementId(b) < elementId(c) AND EXISTS((a)-[:${edgeLabel}]-(c))
                    WITH DISTINCT elementId(a) as a_id, elementId(b) as b_id, elementId(c) as c_id, tmp as tmp
                    set tmp.triangles = tmp.triangles + 1
                    ", {
                    batchSize: 10000
                    
                });



MATCH (start:StableCoinAddress {addressId: "0x74de5d4fcbf63e00296fd95d33236b9794016631"})
CALL {
    WITH start
    MATCH (start)-[r1:StableCoinAction*3..3]->(n1:StableCoinAddress)
    where ALL(rel in r1 where rel.time_stamp >=  1653000000)
    RETURN DISTINCT n1
}
RETURN count(*);

MATCH (start:StableCoinAddress {addressId: "0x74de5d4fcbf63e00296fd95d33236b9794016631"})
CALL {
    WITH start
    MATCH (start)-[r1:StableCoinAction*3..3]->(n1:StableCoinAddress)
    where ALL(rel in r1 where rel.time_stamp >=  1653000000)
    RETURN DISTINCT n1
} IN TRANSACTIONS OF 1000 ROWS
RETURN count(*)
