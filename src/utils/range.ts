export function range(begin: number, end: number) {
	let numbers: number[] = [];
	for (let i = begin;i < end;i++) {
		numbers.push(i);
	}

	return numbers;
}