'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.modes = void 0;
exports.modes = ["create" /* DataMode.CREATE */, "find" /* DataMode.FIND */, "delete" /* DataMode.DELETE */];
class DataLoader {
    constructor(driver, mode) {
        this.driver = driver;
        this.mode = mode;
        this.session = this.driver.session();
        this.ellipticNodeLabel = "EllipticTransaction";
        this.ellipticEdgeLabel = "EllipticAction";
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.session.close();
        });
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadElliptic();
        });
    }
    loadElliptic() {
        return __awaiter(this, void 0, void 0, function* () {
            switch (this.mode) {
                case "create" /* DataMode.CREATE */:
                    yield this.ellipticCreate();
                    break;
                case "find" /* DataMode.FIND */:
                    yield this.ellipticFind();
                    break;
                case "delete" /* DataMode.DELETE */:
                    yield this.ellipticDelete();
                    break;
            }
        });
    }
    ellipticCreate() {
        return __awaiter(this, void 0, void 0, function* () {
            let result;
            result = yield this.session.run(`
            load csv with headers from 'file:///elliptic/txs_features.csv' as tx
            CALL {
                with tx
                create (newTx :${this.ellipticNodeLabel})
                set newTx = tx
            } IN TRANSACTIONS OF 1000 ROWS;`);
            console.log(result);
            result = yield this.session.run(`
                CREATE INDEX ${this.ellipticNodeLabel}_txId_index for (tx:${this.ellipticNodeLabel}) on (tx.txId);`);
            console.log(result);
            result = yield this.session.run(`call db.awaitIndexes()`);
            console.log(result);
            result = yield this.session.run(`
            load csv with headers from 'file:///elliptic/txs_classes.csv' as tx
            CALL {
                with tx
                match (newTx :${this.ellipticNodeLabel} {txId: tx.txId})
                set newTx.class = tx.class
            } IN TRANSACTIONS OF 1000 ROWS;`);
            console.log(result);
            result = yield this.session.run(`
            load csv with headers from 'file:///elliptic/txs_edgelist.csv' as edge
            CALL {
                with edge
                match (tx1 :${this.ellipticNodeLabel} {txId: edge.txId1})
                match (tx2 :${this.ellipticNodeLabel} {txId: edge.txId2})
                create (tx1)-[r:${this.ellipticEdgeLabel}]->(tx2)
            } IN TRANSACTIONS OF 1000 ROWS;`);
            console.log(result);
        });
    }
    ellipticFind() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.session.run(`match (n :${this.ellipticNodeLabel} ) return count(n)`);
            console.log(result.records[0]["_fields"]);
        });
    }
    ellipticDelete() {
        return __awaiter(this, void 0, void 0, function* () {
            let result;
            result = yield this.session.run(`
            match (t:${this.ellipticNodeLabel})
            call {
                with t
                detach delete t
            } IN TRANSACTIONS OF 1000 ROWS;`);
            console.log(result);
            result = yield this.session.run(`
            drop index ${this.ellipticNodeLabel}_txId_index if exists`);
            console.log(result);
        });
    }
}
exports.default = DataLoader;
//# sourceMappingURL=data_loader.js.map