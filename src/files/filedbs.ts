import { FileDB } from './filedb';
import PromiseFunction from '../utils/async';
import { ProgressLabel } from '../utils/progress';
import progress from '../utils/progress';
import { StaticFileDB, type StaticFileDBConfig } from './filedb-static';
import { AssetFileDB, AssetFileDBConfig } from './filedb-assets';
import { resolve } from 'node:path';

const frontendFolder = new URL('../../frontends', import.meta.url).pathname;

export class FileDBs {
	fileDBs = new Map<string, FileDB>();
	constructor() { }
	set(name: string, fileDB: FileDB): void {
		this.fileDBs.set(name, fileDB);
	}
	get(name: string): FileDB {
		const fileDB = this.fileDBs.get(name);
		if (fileDB === undefined) throw Error(`file db not found: ${name}`);
		return fileDB;
	}
	precompress(): PromiseFunction {
		let s: ProgressLabel;
		return PromiseFunction.single(
			async () => {
				// Add a progress label for file compression.
				s = progress.add('precompress files');
			},
			async () => {
				// Mark the start of file compression, perform the compression,
				// update the progress label with the compression status, and then mark it as finished.
				s.start();
				const entries = Array.from(this.fileDBs.values()).map(fileDB => ({ fileDB, sizeSum: 0, sizePos: 0 }));
				await Promise.all(entries.map(async entry => {
					await entry.fileDB.compress((sizePos, sizeSum) => {
						entry.sizeSum = sizeSum;
						entry.sizePos = sizePos;
						const allSum = entries.reduce((sum, e) => sum + e.sizeSum, 0);
						const allPos = entries.reduce((sum, e) => sum + e.sizePos, 0);
						s.updateLabel(`compress files: ${(100 * allPos / allSum).toFixed(0)}%`);
					})
				}));
				s.end();
			},
		);
	}
	enterWatchMode(): void {
		for (const fileDB of this.fileDBs.values()) fileDB.enterWatchMode();
	}
}

export type FileDBConfig = StaticFileDBConfig | AssetFileDBConfig;


export async function loadFileDBConfigs(): Promise<Record<string, FileDBConfig>> {
	return (await import('../../frontends/config.ts?' + Date.now())).fileDBConfigs;
}

export function loadFileDBs(fileDBs: FileDBs): PromiseFunction {
	let s: ProgressLabel;
	let parallel = PromiseFunction.parallel();

	return PromiseFunction.single(
		async () => {
			s = progress.add('load file sources');
			const configs = Object.entries(await loadFileDBConfigs());
			parallel = PromiseFunction.parallel(
				...configs.map(([name, config]): PromiseFunction => {
					let label: ProgressLabel;
					return PromiseFunction.single(
						async () => {
							label = progress.add(name, 1)
						},
						async () => {
							label.start();
							let fileDB: FileDB;
							switch (config.type) {
								case 'static': fileDB = await StaticFileDB.build(config, frontendFolder); break;
								case 'asset': fileDB = await AssetFileDB.build(config); break;
								default:
									// @ts-expect-error Just to be sure
									throw Error(`unknown file db type: ${config.type}`);
							}
							fileDBs.set(name, fileDB);
							label.end();
						}
					)
				})
			);
			await parallel.init();
		},
		async () => {
			s.start();
			await parallel.run();
			s.end();
		},
	);
}