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

export const LANGUAGE_CODES: Record<Language, string> = {
	Arabic:     'ar',
	Chinese:    'zh-CN',
	Dutch:      'nl',
	French:     'fr',
	German:     'de',
	Hindi:      'hi',
	Italian:    'it',
	Japanese:   'ja',
	Korean:     'ko',
	Polish:     'pl',
	Portuguese: 'pt',
	Russian:    'ru',
	Spanish:    'es',
	Swedish:    'sv',
	Turkish:    'tr',
};
