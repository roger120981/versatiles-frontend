import { forEachAsync } from './parallel';
import { jest } from '@jest/globals';

describe('forEachAsync', () => {
	it('should call the callback for each item in the list', async () => {
		const list = [1, 2, 3, 4];
		const callback = jest.fn(async () => { });

		await forEachAsync(list, callback);

		expect(callback).toHaveBeenCalledTimes(list.length);

		list.forEach((item, index) => {
			expect(callback).toHaveBeenCalledWith(item, index);
		});
	});

	it('should handle empty lists without error', async () => {
		const list: number[] = [];
		const callback = jest.fn(async () => { });

		await forEachAsync(list, callback);

		expect(callback).not.toHaveBeenCalled();
	});

	it('should respect the maxParallel limit', async () => {
		const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const maxParallel = 2;
		let concurrentTasks = 0;
		let maxConcurrentTasks = 0;

		const callback = jest.fn(async () => {
			concurrentTasks++;
			maxConcurrentTasks = Math.max(maxConcurrentTasks, concurrentTasks);
			await randomWait(30);
			concurrentTasks--;
		});

		await forEachAsync(list, callback, maxParallel);

		expect(maxConcurrentTasks).toBeLessThanOrEqual(maxParallel);
	});

	it('should reject if any callback call rejects', async () => {
		const list = [1, 2, 3];
		const callback = jest.fn(async (item: number) => {
			if (item === 2) throw new Error('Test error');
		});

		await expect(forEachAsync(list, callback)).rejects.toThrow('Test error');
	});

	it('should resolve successfully when all callbacks are resolved', async () => {
		const list = [1, 2, 3];
		const callback = jest.fn(async () => await randomWait(10));

		await expect(forEachAsync(list, callback)).resolves.toBeUndefined();
	});

	it('should process a list of numbers asynchronously', async () => {
		const list = [1, 1, 2, 3, 5];

		await forEachAsync(list, async (item, index) => {
			list[index] = item + 2;
			await randomWait(10);
		});

		await forEachAsync(list, async (item, index) => {
			list[index] = item + 2;
			await randomWait(10);
		}, 3);

		expect(list).toEqual([5, 5, 6, 7, 9]);
	});

	it('should process items from a synchronous generator', async () => {
		function* syncGenerator() {
			yield 1;
			yield 2;
			yield 3;
		}

		const callback = jest.fn(async () => { });
		await forEachAsync(syncGenerator(), callback);

		expect(callback).toHaveBeenCalledTimes(3);
		expect(callback).toHaveBeenNthCalledWith(1, 1, 0);
		expect(callback).toHaveBeenNthCalledWith(2, 2, 1);
		expect(callback).toHaveBeenNthCalledWith(3, 3, 2);
	});

	it('should process items from an asynchronous generator', async () => {
		async function* asyncGenerator() {
			yield 1;
			yield 2;
			yield 3;
		}

		const callback = jest.fn(async () => { });
		await forEachAsync(asyncGenerator(), callback);

		expect(callback).toHaveBeenCalledTimes(3);
		expect(callback).toHaveBeenNthCalledWith(1, 1, 0);
		expect(callback).toHaveBeenNthCalledWith(2, 2, 1);
		expect(callback).toHaveBeenNthCalledWith(3, 3, 2);
	});

	it('should process items from an iterator', async () => {
		const iterator = [1, 2, 3][Symbol.iterator]();
		const callback = jest.fn(async () => { });

		await forEachAsync(iterator, callback);

		expect(callback).toHaveBeenCalledTimes(3);
		expect(callback).toHaveBeenNthCalledWith(1, 1, 0);
		expect(callback).toHaveBeenNthCalledWith(2, 2, 1);
		expect(callback).toHaveBeenNthCalledWith(3, 3, 2);
	});

	it('should handle errors from an asynchronous generator', async () => {
		async function* asyncErrorGenerator() {
			yield 1;
			yield 2;
			throw new Error('Generator error');
		}

		const callback = jest.fn(async () => { });

		await expect(forEachAsync(asyncErrorGenerator(), callback)).rejects.toThrow('Generator error');
		expect(callback).toHaveBeenCalledTimes(2); // Should only process up to the error
	});
});

function randomWait(maxTime: number): Promise<void> {
	return new Promise(res => setTimeout(res, Math.random() * maxTime));
}
