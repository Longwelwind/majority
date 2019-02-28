import {observable} from "mobx";

export default class ObservableTime {
	 @observable static now: number;

	static init() {
		this.update();
	}

	static update() {
		ObservableTime.now = Date.now();

		requestAnimationFrame(()=> {
			this.update();
		});
	}
}

ObservableTime.init();