export function getPolicyActions(tags: { [key: string]: string }) {
	return []
}
export function getPolicyResources(tags: { [key: string]: any }) {
	return [

	]
}

export function compareArray (inputArray: any, compare: any): Boolean{
	let valid = true;
	inputArray.forEach((value: any)=>{
		if (compare.indexOf(value) < 0) {
			valid = false;
		}
	});
	return valid;
}