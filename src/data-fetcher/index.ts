
import * as program from "commander";
import axios from "axios";
import * as fs from "fs";
import {decode} from "punycode";

function collect(val: string, memo: string[]) {
	memo.push(val);
	return memo;
}

function atob(s: string) {
	return Buffer.from(s, "base64").toString();
}

async function fetch(amount: number, category: string): Promise<{questions: {question: string, real_answer: string}[], answers: string[]}> {
	const response = await axios.get("https://opentdb.com/api.php", {
		params: {
			amount: amount,
			category: category,
			difficulty: "easy",
			type: "multiple",
			encode: "base64"
		}
	});

	const questions = response.data.results.map((q: any) => ({question: atob(q.question), real_answer: atob(q.correct_answer)}));
	const answers = response.data.results.map((q: any) => q.correct_answer).concat(
		...response.data.results.map((q: any) => q.incorrect_answers)
	).map((a: string) => atob(a));

	return {questions, answers};
}

program
	.description("Fetch questions and answers from opentdb.com ")
	.option("-o --output []", "", "data/data.json")
	.option("-c --category []", "", collect,
		[9, 10, 11, 12, 13, 15, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]
	)
	.option("-n --amount []", "", parseInt, 5)
	.option("-r --repeat []", "", parseInt, 10)
	.parse(process.argv);

async function main() {
	let totalQuestions: {question: string, real_answer: string}[] = [];
	let totalAnswers: string[] = [];

	for (let c of program.category) {
		for (let i = 0;i < program.repeat;i++) {
			console.log("Fetching " + program.amount + " questions for category " + c + " [" + (i+1) + "]");
			const {questions, answers} = await fetch(program.amount, c);

			totalQuestions.push(...questions);
			totalAnswers.push(...answers);
		}
	}

	// Remove duplicates
	totalQuestions = totalQuestions.filter((q, i) => totalQuestions.indexOf(q) == i);
	totalAnswers = totalAnswers.filter((a, i) => totalAnswers.indexOf(a) == i);

	console.log(totalQuestions.length + " questions");
	console.log(totalAnswers.length + " answers");

	// Save that in json
	fs.writeFile(program.output, JSON.stringify({questions: totalQuestions, answers: totalAnswers}), err => {
		if (err) {
			console.log(err);
			return;
		}

		console.log("File saved");
	});
}

main();
