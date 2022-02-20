"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const os = __importStar(require("os"));
const tc = __importStar(require("@actions/tool-cache"));
const action_1 = require("@octokit/action");
const request_error_1 = require("@octokit/request-error");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const token = core.getInput('token');
        if (!token) {
            throw new Error(`No github token`);
        }
        core.setSecret(token); // register as secret with the runner so its masked
        const repository = core.getInput('repo');
        if (!repository) {
            throw new Error(`Repo was not specified`);
        }
        const tag = core.getInput('tag');
        if (!tag) {
            throw new Error(`Tag not specified`);
        }
        const [owner, repo] = repository.split('/');
        const osPlatform = os.platform();
        // set up some arch regexs
        let osArch = '';
        switch (os.arch()) {
            case 'x64':
                osArch = 'amd64';
                break;
            default:
                osArch = os.arch();
                return;
        }
        const octokit = new action_1.Octokit();
        let getReleaseUrl;
        try {
            if (tag === 'latest') {
                getReleaseUrl = yield octokit.repos.getLatestRelease({ owner, repo });
            }
            else {
                getReleaseUrl = yield octokit.repos.getReleaseByTag({
                    owner,
                    repo,
                    tag
                });
            }
        }
        catch (e) {
            if (e instanceof request_error_1.RequestError) {
                throw new Error(`Could not find a release in repo: error for ${e.message}`);
            }
            return;
        }
        const re = new RegExp(`_${osPlatform}-${osArch}.zip`);
        const asset = getReleaseUrl.data.assets.find(obj => {
            core.info(`searching for ${obj.name} with ${re.source}`);
            return re.test(obj.name);
        });
        if (!asset) {
            const found = getReleaseUrl.data.assets.map(f => f.name);
            throw new Error(`Could not find a release for ${tag}. Found: ${found}`);
        }
        const url = asset.url;
        const authString = `bearer ${token}`;
        core.info(`Downloading ${repo} from ${url}`);
        const binPath = yield tc.downloadTool(url, '', authString, {
            accept: 'application/octet-stream'
        });
        const extractedPath = yield tc.extractZip(binPath);
        core.info(`Successfully extracted ${repo}: ${getReleaseUrl.data.tag_name} to ${extractedPath}`);
        core.addPath(extractedPath);
    });
}
run();
