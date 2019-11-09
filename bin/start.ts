#!/usr/bin/env node
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

// tslint:disable-next-line:no-import-side-effect
import "source-map-support/register";

import {
    configureLogging,
    PlainLogging,
} from "@atomist/automation-client";
import * as print from "@atomist/cli/lib/print";
import * as appRoot from "app-root-path";
import * as _ from "lodash";
import * as path from "path";
import * as yargs from "yargs";
import {
    executeGoal,
    findGoal,
    GoalExecutor,
} from "../lib/goal";

configureLogging(PlainLogging);

function version(): string {
    try {
        // must be sync because yargs.version only accepts a string
        const pj: any = require(path.join(appRoot.path, "package.json"));
        const dependencies: string[] = [];
        _.forEach(pj.dependencies, (v, k) => {
            if (k.startsWith("@atomist/")) {
                dependencies.push(`${k} ${v}`);
            }
        });
        return `${pj.name} ${pj.version}

${dependencies.sort((d1, d2) => d1.localeCompare(d2)).join("\n")}`;
    } catch (e) {
        print.error(`Failed to read package.json: ${e.message}`);
    }
    return "";
}

async function start(): Promise<any> {
    return yargs.command("*", "Start an SDM Goal", argv => {
        argv.options({
            name: {
                describe: "Name of the goal to start",
                type: "string",
                required: false,
            }, pattern: {
                describe: "Glob pattern matching JavaScript files exporting goals",
                type: "string",
                required: false,
            },
        });
        return yargs;
    }, (argv: any) => {
        const goal = findGoal({
            cwd: appRoot.path,
            name: argv.name,
            pattern: argv.pattern,
        });
        if (!goal) {
            print.error("No exported goal found");
            return 1;
        }
        return executeGoal(goal as GoalExecutor);
    })
        .showHelpOnFail(true, "Specify --help for available options")
        .alias("help", ["h", "?"])
        .version(version())
        .alias("version", "v")
        .describe("version", "Show version information")
        .strict()
        .wrap(Math.min(100, yargs.terminalWidth()))
        .argv;
}
start()
    .catch((err: Error) => {
        print.error(`Unhandled error: ${err.message}`);
        print.error(err.stack as any);
        process.exit(102);
    });
