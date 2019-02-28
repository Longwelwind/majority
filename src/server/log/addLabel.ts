import {format} from "winston";
import {Format} from "logform";

export default function addLabel(labelName: string, value: string): Format {
	return format((info, opts) => {
		info[labelName] = value;
		return info;
	})();
}