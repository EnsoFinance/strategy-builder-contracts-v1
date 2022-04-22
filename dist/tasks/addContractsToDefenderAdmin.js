"use strict";
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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("hardhat/config");
var task_names_1 = require("./task-names");
var dotenv_1 = __importDefault(require("dotenv"));
var defender_admin_client_1 = require("defender-admin-client");
var deployments_json_1 = require("../deployments.json");
var fs = __importStar(require("fs"));
(0, config_1.task)(task_names_1.ADD_CONTRACTS_TO_DEFENDER_ADMIN, "Add Contracts to Defender Admin", function () { return __awaiter(void 0, void 0, void 0, function () {
    var API_KEY, API_SECRET, client, contracts, network, address, importPath, _i, _a, _b, key, value, contract, imported, _c, _d, _e, key, value, contract, imported, _f, _g, _h, key, value, contract, imported, i;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                dotenv_1.default.config();
                API_KEY = process.env.DEFENDER_API_KEY;
                API_SECRET = process.env.DEFENDER_API_SECRET;
                if (API_KEY === undefined || API_SECRET === undefined) {
                    throw Error("addContractsToDefenderAdmin: API_KEY or API_SECRET undefined.");
                }
                client = new defender_admin_client_1.AdminClient({ apiKey: API_KEY, apiSecret: API_SECRET });
                contracts = [];
                network = 'mainnet';
                address = '';
                importPath = '';
                _i = 0, _a = Object.entries(deployments_json_1.mainnet);
                _j.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                _b = _a[_i], key = _b[0], value = _b[1];
                address = value;
                contract = { network: network, address: address, name: '', abi: '' };
                contract.address = address;
                contract.name = key;
                importPath = 'artifacts/contracts/' + key + '.sol/' + key + '.json';
                if (!fs.existsSync(importPath))
                    return [3 /*break*/, 3];
                importPath = '../' + importPath; // fs and import resolve paths differently
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require(importPath)); })];
            case 2:
                imported = _j.sent();
                contract.abi = JSON.stringify(imported.abi);
                contracts.push(contract);
                _j.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                _c = 0, _d = Object.entries(deployments_json_1.mainnet);
                _j.label = 5;
            case 5:
                if (!(_c < _d.length)) return [3 /*break*/, 8];
                _e = _d[_c], key = _e[0], value = _e[1];
                address = value;
                contract = { network: network, address: address, name: '', abi: '' };
                contract.address = address;
                contract.name = key;
                importPath = 'artifacts/contracts/oracles/registries/' + key + '.sol/' + key + '.json';
                if (!fs.existsSync(importPath))
                    return [3 /*break*/, 7];
                importPath = '../' + importPath; // fs and import resolve paths differently
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require(importPath)); })];
            case 6:
                imported = _j.sent();
                contract.abi = JSON.stringify(imported.abi);
                contracts.push(contract);
                _j.label = 7;
            case 7:
                _c++;
                return [3 /*break*/, 5];
            case 8:
                _f = 0, _g = Object.entries(deployments_json_1.mainnet);
                _j.label = 9;
            case 9:
                if (!(_f < _g.length)) return [3 /*break*/, 12];
                _h = _g[_f], key = _h[0], value = _h[1];
                address = value;
                contract = { network: network, address: address, name: '', abi: '' };
                contract.address = address;
                contract.name = key;
                importPath = 'artifacts/contracts/oracles/' + key + '.sol/' + key + '.json';
                if (!fs.existsSync(importPath))
                    return [3 /*break*/, 11];
                importPath = '../' + importPath; // fs and import resolve paths differently
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require(importPath)); })];
            case 10:
                imported = _j.sent();
                contract.abi = JSON.stringify(imported.abi);
                contracts.push(contract);
                _j.label = 11;
            case 11:
                _f++;
                return [3 /*break*/, 9];
            case 12:
                i = 0;
                _j.label = 13;
            case 13:
                if (!(i < contracts.length)) return [3 /*break*/, 16];
                return [4 /*yield*/, client.addContract(contracts[i])];
            case 14:
                _j.sent();
                _j.label = 15;
            case 15:
                i++;
                return [3 /*break*/, 13];
            case 16: return [2 /*return*/];
        }
    });
}); });
