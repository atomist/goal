import { ProgressLog } from "@atomist/sdm";
import { format } from "@atomist/sdm/src/lib/api-helper/log/format";

export class PrintLoggingProgressLog implements ProgressLog {

    constructor(public name: string) {
    }

    public write(msg: string, ...args: string[]): void {
        const what = format(msg || "", ...args);
        // tslint:disable-next-line:no-console
        console.info(`${this.name}: [INFO] ${what}`);
    }

    public async isAvailable(): Promise<boolean> {
        return true;
    }

    public flush(): Promise<void> {
        return Promise.resolve();
    }

    public close(): Promise<void> {
        return Promise.resolve();
    }

}
