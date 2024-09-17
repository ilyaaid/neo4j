'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const data_loader_1 = __importStar(require("./data_loader"));
const commander_1 = require("commander");
const URI = 'neo4j://localhost:7687';
const USER = 'neo4j';
const PASSWORD = 'neo4jtest';
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let driver;
        try {
            driver = neo4j_driver_1.default.driver(URI, neo4j_driver_1.default.auth.basic(USER, PASSWORD));
            const serverInfo = yield driver.getServerInfo();
            console.log('Connection established');
            commander_1.program
                .command('data <data_mode:string>')
                .description('action with data')
                .action((data_mode) => __awaiter(this, void 0, void 0, function* () {
                if (!(data_loader_1.modes.includes(data_mode))) {
                    commander_1.program.error(`wrong data mode: ${data_mode}`);
                }
                let dl = new data_loader_1.default(driver, data_mode);
                yield dl.load();
                yield dl.close();
            }));
            commander_1.program
                .command('query <string>')
                .description('query with data')
                .action((config_file) => {
                console.log(config_file);
            });
            yield commander_1.program.parseAsync(process.argv);
            yield driver.close();
        }
        catch (err) {
            if (err instanceof Error) {
                console.log(`Connection error\n${err}\nCause: ${err}`);
            }
        }
    });
}
main();
//# sourceMappingURL=main.js.map