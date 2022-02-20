import * as core from '@actions/core'
import * as os from 'os'
import * as tc from '@actions/tool-cache'

import {Octokit} from '@octokit/action'
import {RequestError} from '@octokit/request-error'

async function run(): Promise<void> {
    const token = core.getInput('token')
    if (!token) {
        throw new Error(`No github token`)
    }
    core.setSecret(token) // register as secret with the runner so its masked
    const repository = core.getInput('repo')
    if (!repository) {
        throw new Error(`Repo was not specified`)
    }

    const tag = core.getInput('tag')
    if (!tag) {
        throw new Error(`Tag not specified`)
    }
    const [owner, repo] = repository.split('/')
    const osPlatform = os.platform()
    // set up some arch regexs
    let osArch = ''
    switch (os.arch()) {
        case 'x64':
            osArch = 'amd64'
            break
        default:
            osArch = os.arch()
            return
    }
    const octokit = new Octokit()
    let getReleaseUrl
    try {
        if (tag === 'latest') {
            getReleaseUrl = await octokit.repos.getLatestRelease({owner, repo})
        } else {
            getReleaseUrl = await octokit.repos.getReleaseByTag({
                owner,
                repo,
                tag
            })
        }
    } catch (e) {
        if (e instanceof RequestError) {
            throw new Error(
                `Could not find a release in repo: error for ${e.message}`
            )
        }
        return
    }

    const re = new RegExp(`_${osPlatform}-${osArch}.zip`)
    const asset = getReleaseUrl.data.assets.find(obj => {
        core.info(`searching for ${obj.name} with ${re.source}`)
        return re.test(obj.name)
    })
    if (!asset) {
        const found = getReleaseUrl.data.assets.map(f => f.name)
        throw new Error(`Could not find a release for ${tag}. Found: ${found}`)
    }

    const url = asset.url
    const authString = `bearer ${token}`

    core.info(`Downloading ${repo} from ${url}`)
    const binPath = await tc.downloadTool(url, '', authString, {
        accept: 'application/octet-stream'
    })
    const extractedPath = await tc.extractZip(binPath)
    core.info(
        `Successfully extracted ${repo}: ${getReleaseUrl.data.tag_name} to ${extractedPath}`
    )

    core.addPath(extractedPath)
}

run()
