/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    GitCommandGitProject,
    GitHubRepoRef,
    GitProject,
} from "@atomist/automation-client";
import * as print from "@atomist/cli/lib/print";
import {
    ProjectAwareGoalInvocation,
    SdmGoalEvent,
    toProjectAwareGoalInvocation,
} from "@atomist/sdm";
import { toArray } from "@atomist/sdm-core";
import * as fs from "fs-extra";
import * as glob from "glob";
import * as path from "path";
import { PrintLoggingProgressLog } from "./PrintLoggingProgressLog";

export type GoalExecutor = (gi: Pick<ProjectAwareGoalInvocation, "goalEvent" | "project" | "progressLog" | "spawn" | "exec">) =>
    Promise<void | SdmGoalResult>;

export type SdmGoalResult =
    Pick<SdmGoalEvent, "state" | "description" | "phase" | "externalUrls" | "data">
    & { push: { version: string } }
    & { push: { after: { images: Array<{ imageName: string }> } } };

export async function executeGoal(goal: { goalExecutor: GoalExecutor, name: string }): Promise<number> {

    if (!process.env.ATOMIST_GOAL || !process.env.ATOMIST_PROJECT_DIR || !process.env.ATOMIST_RESULT) {
        print.error(`Missing environment variables, aborting: ATOMIST_GOAL=${process.env.ATOMIST_GOAL} ` +
            `ATOMIST_PROJECT_DIR=${process.env.ATOMIST_PROJECT_DIR} ATOMIST_RESULT=${process.env.ATOMIST_RESULT}`);
        return 1;
    }

    const progressLog = new PrintLoggingProgressLog(goal.name);

    try {
        const goalEvent: SdmGoalEvent = await fs.readJson(process.env.ATOMIST_GOAL);
        const project: GitProject = await GitCommandGitProject.fromExistingDirectory(GitHubRepoRef.from({
            owner: goalEvent.repo.owner,
            repo: goalEvent.repo.name,
            branch: goalEvent.branch,
            sha: goalEvent.push.after?.sha || undefined,
        }), process.env.ATOMIST_PROJECT_DIR) as any;

        const result = goal.goalExecutor(toProjectAwareGoalInvocation(project, { goalEvent, project, progressLog } as any));
        if (!!result) {
            await fs.writeJson(process.env.ATOMIST_RESULT, { SdmGoal: result });
        }
        return 0;
    } catch (e) {
        print.error(`Unhandled error: ${e.message}\n`);
        print.error(e.stack);
        return 102;
    } finally {
        await progressLog.close();
    }
}

export function findGoal(options: { cwd: string, pattern?: string, name?: string }): { goalExecutor: GoalExecutor, name: string } | undefined {
    const files = resolveFiles(options.cwd, options.pattern);
    for (const file of files) {
        const goalFile = require(path.join(options.cwd, file));
        for (const k in goalFile) {
            if (goalFile.hasOwnProperty(k) && (!options.name || options.name === k)) {
                const goal = goalFile[k];
                if (!!goal) {
                    print.info(`Starting goal executor '${k}' from '${path.join(options.cwd, file)}'`);
                    return { goalExecutor: goal, name: k };
                }
            }
        }
    }
    return undefined;
}

function resolveFiles(cwd: string, patterns: string | string[] = ["goal.js"]): string[] {
    const files = [];
    for (const pattern of toArray(patterns)) {
        files.push(...glob.sync(pattern, { cwd }));
    }
    return files;
}
