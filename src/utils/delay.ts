export async function delay(time: number): Promise<null> {
	return new Promise(resolve => {
		setTimeout(() => {
			resolve();
		}, time * 1000);
	});
}