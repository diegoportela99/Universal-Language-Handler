export const SUPPORTED_LANGUAGES = [
	'Arabic',
	'Chinese',
	'Dutch',
	'French',
	'German',
	'Hindi',
	'Italian',
	'Japanese',
	'Korean',
	'Polish',
	'Portuguese',
	'Russian',
	'Spanish',
	'Swedish',
	'Turkish',
] as const;

export type Language = typeof SUPPORTED_LANGUAGES[number];
