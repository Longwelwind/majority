import * as fs from "fs";
import * as util from "util";
import {Simulate} from "react-dom/test-utils";

const readFile = util.promisify(fs.readFile);

let data: {questions: {question: string, real_answer: string}[], answers: string[]} = {
	questions: [],
	answers: []
};

async function loadData() {
	const content = await readFile("data/data.json");
	const loadedData = JSON.parse(content.toString());

	data = loadedData;
}

loadData();

export default class QuestionService {
	static getRandomQuestionAndAnswers(count_answers: number = 3): {question: string, answers: string[]} {
		const question = data.questions[Math.floor(Math.random() * data.questions.length)];
		const answers: string[] = [];

		while (answers.length < count_answers && answers.length < data.answers.length) {
			const possibleAnswer = data.answers[Math.floor(Math.random() * data.answers.length)];
			if (answers.indexOf(possibleAnswer) == -1) {
				answers.push(possibleAnswer);
			}
		}

		return {question: question.question, answers};
	}
}
